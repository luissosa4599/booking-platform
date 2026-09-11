using BookingEngine.Domain;
using BookingEngine.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace BookingEngine.Worker;

/// <summary>
/// Each sweep pushes a "your booking is soon" reminder for every confirmed
/// booking whose start falls in the <see cref="WindowStart"/>..<see cref="WindowEnd"/>
/// window, to every device registered for that user. This is what actually
/// covers the one-tap Explore booking flow — the old client-local
/// `expo-notifications` reminder (see app/src/lib/notifications.ts, removed in
/// this same change) only ever fired for the long detail-screen flow. Runs on
/// a 60s loop locally; deployed, a scheduler drives one sweep every ~20 min.
/// </summary>
public class ReminderService(
    IServiceScopeFactory scopeFactory,
    ExpoPushClient pushClient,
    ILogger<ReminderService> logger) : BackgroundService, IOneShotPass
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(60);

    // "Reminder time" is a window, not a point: a sweep fires the reminder for
    // any booking whose start falls in [now + WindowStart, now + WindowEnd].
    // The window MUST be wider than the gap between sweeps (plus scheduler
    // jitter) or a booking can start in the dead space between two sweeps and
    // never get a reminder. Deployed, sweeps are a Cloud Scheduler job every
    // ~20 min (not the 60s local loop) — so 22-50 (28 min wide) leaves a
    // comfortable overlap. SentNotification (keyed by bookingId) makes the
    // repeated matches across overlapping sweeps a no-op.
    //   NOTE: push delivery itself is inert until EAS is wired
    //   (EXPO_PUBLIC_EAS_PROJECT_ID — roadmap §4). Retune this window + the
    //   copy below against real device testing when that lands.
    private static readonly TimeSpan WindowStart = TimeSpan.FromMinutes(22);
    private static readonly TimeSpan WindowEnd = TimeSpan.FromMinutes(50);

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

    public async Task RunOnceAsync(CancellationToken ct)
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
                    "Tu reserva empieza pronto.",
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
