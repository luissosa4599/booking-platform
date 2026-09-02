using BookingEngine.Domain;
using BookingEngine.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace BookingEngine.Worker;

/// <summary>
/// Polls every 60s for confirmed bookings starting in ~30 minutes and pushes a
/// reminder to every device registered for that user. This is what actually
/// covers the one-tap Explore booking flow — the old client-local
/// `expo-notifications` reminder (see app/src/lib/notifications.ts, removed in
/// this same change) only ever fired for the long detail-screen flow.
/// </summary>
public class ReminderService(
    IServiceScopeFactory scopeFactory,
    ExpoPushClient pushClient,
    ILogger<ReminderService> logger) : BackgroundService
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(60);

    // A booking starting 28-32 minutes out is "reminder time" — a 4-minute
    // window comfortably covers one poll's worth of drift either way.
    private static readonly TimeSpan WindowStart = TimeSpan.FromMinutes(28);
    private static readonly TimeSpan WindowEnd = TimeSpan.FromMinutes(32);

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
                // A bad poll shouldn't kill the loop — log and try again next tick.
                logger.LogError(ex, "ReminderService poll failed");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task RunOnceAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();

        var now = DateTimeOffset.UtcNow;
        var windowStart = now + WindowStart;
        var windowEnd = now + WindowEnd;

        var candidates = await db.Bookings
            .Include(b => b.AvailabilitySlot)
            .ThenInclude(s => s.Resource)
            .Where(b => b.Status == BookingStatus.Confirmed
                && b.AvailabilitySlot.StartsAt >= windowStart
                && b.AvailabilitySlot.StartsAt <= windowEnd)
            .ToListAsync(ct);

        if (candidates.Count == 0)
        {
            return;
        }

        var sent = 0;
        foreach (var booking in candidates)
        {
            var alreadySent = await db.SentNotifications.AnyAsync(
                s => s.BookingId == booking.Id && s.Type == SentNotificationType.Reminder, ct);
            if (alreadySent)
            {
                continue;
            }

            var tokens = await db.PushTokens
                .Where(t => t.UserId == booking.UserId)
                .ToListAsync(ct);

            // No device registered yet — don't mark it sent, so a token
            // registered in the next poll or two still gets the reminder
            // before the 4-minute window closes.
            if (tokens.Count == 0)
            {
                continue;
            }

            foreach (var token in tokens)
            {
                var outcome = await pushClient.SendAsync(
                    token.ExpoPushToken,
                    booking.AvailabilitySlot.Resource.Name,
                    "Tu reserva empieza en 30 minutos.",
                    ct);

                if (outcome == PushOutcome.TokenInvalid)
                {
                    db.PushTokens.Remove(token);
                }
            }

            db.SentNotifications.Add(new SentNotification
            {
                Id = Guid.NewGuid(),
                UserId = booking.UserId,
                Type = SentNotificationType.Reminder,
                BookingId = booking.Id,
                SentAt = now,
            });
            sent++;
        }

        if (sent > 0)
        {
            logger.LogInformation("ReminderService sent {Count} reminder(s)", sent);
        }

        await db.SaveChangesAsync(ct);
    }
}
