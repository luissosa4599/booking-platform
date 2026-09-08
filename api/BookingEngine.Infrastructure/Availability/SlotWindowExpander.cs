using BookingEngine.Domain;

namespace BookingEngine.Infrastructure.Availability;

public static class AvailabilityHorizon
{
    /// <summary>How many days forward the weekly schedule is expanded into concrete slots.</summary>
    public const int Days = 14;
}

/// <summary>
/// Turns a resource's <see cref="WeeklySchedule"/> into concrete
/// <see cref="AvailabilitySlot"/> rows for the next <see cref="AvailabilityHorizon.Days"/>
/// days. Pure and DB-free so it's unit-testable without a database, and shared
/// by the API (expand on save) and the worker (roll the window forward daily).
///
/// Time-zone handling mirrors DevSeeder.GenerateSlots: local wall-clock hours
/// converted to UTC instants via the location's IANA zone.
/// </summary>
public static class SlotWindowExpander
{
    /// <summary>
    /// The new slots to insert — schedule windows in range that don't already
    /// have a slot at that exact start. Never returns duplicates of
    /// <paramref name="existingSlots"/>.
    /// </summary>
    public static IReadOnlyList<AvailabilitySlot> Expand(
        Guid resourceId,
        string ianaTimeZone,
        WeeklySchedule schedule,
        IReadOnlyCollection<AvailabilitySlot> existingSlots,
        DateTimeOffset now,
        int horizonDays = AvailabilityHorizon.Days)
    {
        var tz = TimeZoneInfo.FindSystemTimeZoneById(ianaTimeZone);
        var duration = TimeSpan.FromMinutes(schedule.SlotDurationMinutes);
        var byDay = schedule.Days
            .Where(d => d.Enabled)
            .ToDictionary(d => d.Weekday);

        var existingStarts = existingSlots
            .Select(s => s.StartsAt.UtcDateTime)
            .ToHashSet();

        var todayLocal = TimeZoneInfo
            .ConvertTimeFromUtc(now.UtcDateTime, tz)
            .Date;

        var result = new List<AvailabilitySlot>();

        for (var offset = 0; offset <= horizonDays; offset++)
        {
            var dateLocal = todayLocal.AddDays(offset);
            if (!byDay.TryGetValue(dateLocal.DayOfWeek, out var day))
            {
                continue;
            }

            if (day.CloseTime <= day.OpenTime)
            {
                continue;
            }

            var cursor = day.OpenTime;
            while (cursor < day.CloseTime)
            {
                var endLocalTime = cursor.Add(duration);
                if (endLocalTime > day.CloseTime)
                {
                    break;
                }

                var startLocal = DateTime.SpecifyKind(
                    dateLocal.Add(cursor.ToTimeSpan()), DateTimeKind.Unspecified);

                // A local time in the spring-forward gap doesn't exist — skip it.
                if (!tz.IsInvalidTime(startLocal))
                {
                    var startUtc = TimeZoneInfo.ConvertTimeToUtc(startLocal, tz);
                    if (startUtc >= now.UtcDateTime && !existingStarts.Contains(startUtc))
                    {
                        var startsAt = new DateTimeOffset(startUtc, TimeSpan.Zero);
                        result.Add(new AvailabilitySlot
                        {
                            Id = Guid.NewGuid(),
                            ResourceId = resourceId,
                            StartsAt = startsAt,
                            EndsAt = startsAt + duration,
                            CapacityRemaining = schedule.Capacity,
                            Origin = SlotOrigin.Schedule,
                            IsBlocked = false,
                        });
                    }
                }

                cursor = endLocalTime;
            }
        }

        return result;
    }

    /// <summary>
    /// Predicate for the schedule-generated slots that no longer belong (the
    /// host narrowed the hours or disabled a day). Only unblocked, unbooked
    /// <see cref="SlotOrigin.Schedule"/> slots are ever a candidate for deletion.
    /// Evaluated in memory over already-loaded slots (each with its Bookings).
    /// </summary>
    public static bool IsOrphanedScheduleSlot(
        AvailabilitySlot slot,
        string ianaTimeZone,
        WeeklySchedule schedule)
    {
        if (slot.Origin != SlotOrigin.Schedule || slot.IsBlocked)
        {
            return false;
        }

        if (slot.Bookings.Any(b => b.Status == BookingStatus.Confirmed))
        {
            return false;
        }

        var tz = TimeZoneInfo.FindSystemTimeZoneById(ianaTimeZone);
        var startLocal = TimeZoneInfo.ConvertTimeFromUtc(slot.StartsAt.UtcDateTime, tz);
        var endLocal = TimeZoneInfo.ConvertTimeFromUtc(slot.EndsAt.UtcDateTime, tz);

        var day = schedule.Days.FirstOrDefault(
            d => d.Enabled && d.Weekday == startLocal.DayOfWeek);
        if (day is null)
        {
            return true;
        }

        var openWindow = TimeOnly.FromDateTime(startLocal) >= day.OpenTime
            && TimeOnly.FromDateTime(endLocal) <= day.CloseTime;
        return !openWindow;
    }
}
