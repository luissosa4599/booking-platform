using BookingEngine.Domain;
using BookingEngine.Infrastructure;
using BookingEngine.Infrastructure.Availability;
using Microsoft.EntityFrameworkCore;

namespace BookingEngine.Worker;

/// <summary>
/// Rolls the availability window forward for every resource that has a weekly
/// schedule: adds slots that have entered the horizon since the last run and
/// prunes now-orphaned unbooked schedule slots. The API also expands on every
/// schedule save; this is the daily catch-up so the window never runs dry.
/// </summary>
public class ScheduleExpansionService(
    IServiceScopeFactory scopeFactory,
    ILogger<ScheduleExpansionService> logger) : BackgroundService
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromHours(6);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Run once at startup, then on the interval.
        await RunSafelyAsync(stoppingToken);

        using var timer = new PeriodicTimer(PollInterval);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            await RunSafelyAsync(stoppingToken);
        }
    }

    private async Task RunSafelyAsync(CancellationToken ct)
    {
        try
        {
            await RunOnceAsync(ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "ScheduleExpansionService poll failed");
        }
    }

    private async Task RunOnceAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();

        var now = DateTimeOffset.UtcNow;
        var scheduled = await db.WeeklySchedules
            .Include(w => w.Days)
            .Include(w => w.Resource)
                .ThenInclude(r => r.Location)
            .ToListAsync(ct);

        var added = 0;
        var removed = 0;

        foreach (var schedule in scheduled)
        {
            var timeZone = schedule.Resource.Location.TimeZone;

            var slots = await db.AvailabilitySlots
                .Include(s => s.Bookings)
                .Where(s => s.ResourceId == schedule.ResourceId && s.EndsAt >= now)
                .ToListAsync(ct);

            var toAdd = SlotWindowExpander.Expand(schedule.ResourceId, timeZone, schedule, slots, now);
            var toRemove = slots
                .Where(s => SlotWindowExpander.IsOrphanedScheduleSlot(s, timeZone, schedule))
                .ToList();

            if (toAdd.Count > 0)
            {
                db.AvailabilitySlots.AddRange(toAdd);
                added += toAdd.Count;
            }

            if (toRemove.Count > 0)
            {
                db.AvailabilitySlots.RemoveRange(toRemove);
                removed += toRemove.Count;
            }
        }

        if (added > 0 || removed > 0)
        {
            await db.SaveChangesAsync(ct);
            logger.LogInformation(
                "ScheduleExpansionService: +{Added} slot(s), -{Removed} orphaned", added, removed);
        }
    }
}
