namespace BookingEngine.Api.Application.Bookings;

/// <summary>
/// Counts consecutive calendar weeks (up to and including the current one) that
/// have at least one confirmed booking. Feeds the "Octava semana seguida" line
/// on the confirmation screen — shown only when the streak is >= 3.
/// </summary>
public static class BookingStreak
{
    public static int Count(IEnumerable<DateTimeOffset> confirmedSlotStarts, DateTimeOffset now)
    {
        var weeks = confirmedSlotStarts
            .Select(s => MondayOf(s.UtcDateTime))
            .ToHashSet();

        if (weeks.Count == 0)
        {
            return 0;
        }

        var cursor = MondayOf(now.UtcDateTime);

        // If nothing this week yet, the streak can still be alive through last week.
        if (!weeks.Contains(cursor))
        {
            cursor = cursor.AddDays(-7);
        }

        var count = 0;
        while (weeks.Contains(cursor))
        {
            count++;
            cursor = cursor.AddDays(-7);
        }

        return count;
    }

    private static DateOnly MondayOf(DateTime instant)
    {
        var date = DateOnly.FromDateTime(instant);
        var offsetFromMonday = ((int)date.DayOfWeek + 6) % 7;
        return date.AddDays(-offsetFromMonday);
    }
}
