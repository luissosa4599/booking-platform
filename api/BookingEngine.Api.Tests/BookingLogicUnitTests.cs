using BookingEngine.Api.Application.Bookings;

namespace BookingEngine.Api.Tests;

/// <summary>
/// Pure-logic tests — no Postgres, no Docker, so these run everywhere the
/// Testcontainers-based suites can't.
/// </summary>
public class BookingLogicUnitTests
{
    [Theory]
    [InlineData("Sala Boreal 204", "SAL")]
    [InlineData("Cabina de audio 3", "CAB")]
    [InlineData("A3", "AXX")]
    [InlineData("12B flex", "BFL")]
    public void BookingCode_Prefix_IsThreeLettersFromName(string name, string expected)
    {
        Assert.Equal(expected, BookingCode.Prefix(name));
    }

    [Fact]
    public void BookingCode_Generate_MatchesExpectedShape()
    {
        var code = BookingCode.Generate("Sala Boreal 204", new Random(1));
        Assert.Matches("^[A-Z]{3}-[0-9]{4}$", code);
    }

    [Fact]
    public void BookingStreak_CountsConsecutiveWeeksEndingThisWeek()
    {
        var now = new DateTimeOffset(2026, 8, 27, 12, 0, 0, TimeSpan.Zero); // a Thursday
        var starts = new[]
        {
            now.AddDays(-1),   // this week
            now.AddDays(-8),   // last week
            now.AddDays(-15),  // two weeks ago
            now.AddDays(-40),  // gap — breaks the streak here
        };

        Assert.Equal(3, BookingStreak.Count(starts, now));
    }

    [Fact]
    public void BookingStreak_StillAliveWhenCurrentWeekHasNothingButLastWeekDoes()
    {
        var now = new DateTimeOffset(2026, 8, 27, 12, 0, 0, TimeSpan.Zero);
        var starts = new[] { now.AddDays(-8), now.AddDays(-15) };

        Assert.Equal(2, BookingStreak.Count(starts, now));
    }

    [Fact]
    public void BookingStreak_ZeroWhenNothingRecent()
    {
        var now = new DateTimeOffset(2026, 8, 27, 12, 0, 0, TimeSpan.Zero);
        var starts = new[] { now.AddDays(-30) };

        Assert.Equal(0, BookingStreak.Count(starts, now));
    }
}
