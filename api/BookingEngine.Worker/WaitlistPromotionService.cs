using BookingEngine.Domain;
using BookingEngine.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace BookingEngine.Worker;

/// <summary>
/// Polls the transactional outbox (written by the API's DELETE /bookings/{id}
/// in the same SaveChanges as the cancellation itself — see BookingsEndpoints)
/// and, for each "a slot opened up" event, pushes the oldest not-yet-notified
/// person on that slot's waitlist. This is the backend half of the handoff's
/// "Se libera para alguien de la lista de espera" copy — there was no server
/// behavior behind that line before this worker existed.
/// </summary>
public class WaitlistPromotionService(
    IServiceScopeFactory scopeFactory,
    ExpoPushClient pushClient,
    ILogger<WaitlistPromotionService> logger) : BackgroundService
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(15);
    private const int BatchSize = 20;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(PollInterval);
        do
        {
            try
            {
                await RunOnceAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "WaitlistPromotionService poll failed");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task RunOnceAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();

        var events = await db.NotificationOutbox
            .Where(o => o.Type == NotificationType.WaitlistSlotOpened && o.ProcessedAt == null)
            .OrderBy(o => o.CreatedAt)
            .Take(BatchSize)
            .ToListAsync(ct);

        if (events.Count == 0)
        {
            return;
        }

        var promoted = 0;
        foreach (var evt in events)
        {
            evt.ProcessedAt = DateTimeOffset.UtcNow;
            evt.Attempts++;

            // Oldest entry on this slot's waitlist that hasn't already been
            // told about an opening. Multiple cancellations on the same slot
            // each promote the next person in line, one at a time.
            var candidates = await db.WaitlistEntries
                .Where(w => w.AvailabilitySlotId == evt.AvailabilitySlotId)
                .OrderBy(w => w.CreatedAt)
                .ToListAsync(ct);

            WaitlistEntry? next = null;
            foreach (var candidate in candidates)
            {
                var alreadyNotified = await db.SentNotifications.AnyAsync(
                    s => s.UserId == candidate.UserId
                        && s.Type == SentNotificationType.WaitlistSlotOpened
                        && s.AvailabilitySlotId == evt.AvailabilitySlotId,
                    ct);
                if (!alreadyNotified)
                {
                    next = candidate;
                    break;
                }
            }

            if (next is null)
            {
                continue; // nobody waiting, or everyone already notified
            }

            var slot = await db.AvailabilitySlots
                .Include(s => s.Resource)
                .FirstOrDefaultAsync(s => s.Id == evt.AvailabilitySlotId, ct);
            if (slot is null)
            {
                continue; // slot itself was deleted since — nothing to promote into
            }

            var tokens = await db.PushTokens
                .Where(t => t.UserId == next.UserId)
                .ToListAsync(ct);

            foreach (var token in tokens)
            {
                var outcome = await pushClient.SendAsync(
                    token.ExpoPushToken,
                    slot.Resource.Name,
                    "Se liberó un lugar de tu lista de espera.",
                    ct);

                if (outcome == PushOutcome.TokenInvalid)
                {
                    db.PushTokens.Remove(token);
                }
            }

            // Recorded even with zero tokens — "we already told this person
            // about this opening" is true regardless of whether a push could
            // physically be delivered, and it keeps this idempotent.
            db.SentNotifications.Add(new SentNotification
            {
                Id = Guid.NewGuid(),
                UserId = next.UserId,
                Type = SentNotificationType.WaitlistSlotOpened,
                AvailabilitySlotId = evt.AvailabilitySlotId,
                SentAt = DateTimeOffset.UtcNow,
            });
            promoted++;
        }

        if (promoted > 0)
        {
            logger.LogInformation("WaitlistPromotionService promoted {Count} waitlist entry(s)", promoted);
        }

        await db.SaveChangesAsync(ct);
    }
}
