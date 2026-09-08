using BookingEngine.Domain;
using BookingEngine.Infrastructure.Availability;

namespace BookingEngine.Api.Tests;

/// <summary>
/// Pure unit tests for the weekly-schedule -> slots expander. No database, no
/// Docker — this is the local coverage for the riskiest bit of PR B1.
/// </summary>
public class SlotWindowExpanderTests
{
    private const string Tz = "America/Mexico_City"; // fixed UTC-6 (Mexico dropped DST in 2022)
    private static readonly Guid Resource = Guid.NewGuid();

    private static WeeklySchedule Schedule(int durationMin, int capacity, params (DayOfWeek day, string open, string close)[] days) =>
        new()
        {
            Id = Guid.NewGuid(),
            ResourceId = Resource,
            SlotDurationMinutes = durationMin,
            Capacity = capacity,
            Days = days.Select(d => new WeeklyScheduleDay
            {
                Id = Guid.NewGuid(),
                Weekday = d.day,
                OpenTime = TimeOnly.Parse(d.open),
                CloseTime = TimeOnly.Parse(d.close),
                Enabled = true,
            }).ToList(),
        };

    [Fact]
    public void Expand_OneWeekday_ShortWindow_ProducesExactBlocks()
    {
        // Monday 2026-03-02, 06:00 local (12:00Z) — before the 08:00 open.
        var now = new DateTimeOffset(2026, 3, 2, 12, 0, 0, TimeSpan.Zero);
        var schedule = Schedule(60, 4, (DayOfWeek.Monday, "08:00", "12:00"));

        var slots = SlotWindowExpander.Expand(Resource, Tz, schedule, [], now, horizonDays: 6);

        // Only Monday the 2nd is in a 6-day window (Mon..Sun). 08-12 / 60min = 4 blocks.
        Assert.Equal(4, slots.Count);
        Assert.All(slots, s =>
        {
            Assert.Equal(Resource, s.ResourceId);
            Assert.Equal(SlotOrigin.Schedule, s.Origin);
            Assert.Equal(4, s.CapacityRemaining);
            Assert.False(s.IsBlocked);
            Assert.Equal(TimeSpan.FromMinutes(60), s.EndsAt - s.StartsAt);
            Assert.True(s.StartsAt >= now);
        });

        // 08:00 local Monday == 14:00Z (UTC-6).
        var starts = slots.Select(s => s.StartsAt).OrderBy(x => x).ToList();
        Assert.Equal(new DateTimeOffset(2026, 3, 2, 14, 0, 0, TimeSpan.Zero), starts[0]);
        Assert.Equal(new DateTimeOffset(2026, 3, 2, 17, 0, 0, TimeSpan.Zero), starts[3]);
    }

    [Fact]
    public void Expand_SkipsBlocksAlreadyStarted()
    {
        // Monday 09:30 local (15:30Z) — the 08:00 and 09:00 blocks are in the past.
        var now = new DateTimeOffset(2026, 3, 2, 15, 30, 0, TimeSpan.Zero);
        var schedule = Schedule(60, 2, (DayOfWeek.Monday, "08:00", "12:00"));

        var slots = SlotWindowExpander.Expand(Resource, Tz, schedule, [], now, horizonDays: 6);

        // Only the 10:00 and 11:00 blocks remain.
        Assert.Equal(2, slots.Count);
        Assert.All(slots, s => Assert.True(s.StartsAt >= now));
    }

    [Fact]
    public void Expand_IsIdempotent_GivenItsOwnOutputAsExisting()
    {
        var now = new DateTimeOffset(2026, 3, 2, 12, 0, 0, TimeSpan.Zero);
        var schedule = Schedule(90, 5,
            (DayOfWeek.Monday, "08:00", "20:00"),
            (DayOfWeek.Tuesday, "08:00", "20:00"),
            (DayOfWeek.Wednesday, "08:00", "20:00"));

        var first = SlotWindowExpander.Expand(Resource, Tz, schedule, [], now);
        Assert.NotEmpty(first);

        var second = SlotWindowExpander.Expand(Resource, Tz, schedule, first, now);
        Assert.Empty(second);
    }

    [Fact]
    public void Expand_MonToFri_14Days_CountsEveryWeekday()
    {
        var now = new DateTimeOffset(2026, 3, 2, 12, 0, 0, TimeSpan.Zero); // Monday
        var schedule = Schedule(60, 3,
            (DayOfWeek.Monday, "08:00", "12:00"),
            (DayOfWeek.Tuesday, "08:00", "12:00"),
            (DayOfWeek.Wednesday, "08:00", "12:00"),
            (DayOfWeek.Thursday, "08:00", "12:00"),
            (DayOfWeek.Friday, "08:00", "12:00"));

        var slots = SlotWindowExpander.Expand(Resource, Tz, schedule, [], now, horizonDays: 14);

        var expectedWeekdays = Enumerable.Range(0, 15)
            .Select(o => now.UtcDateTime.Date.AddDays(o).DayOfWeek)
            .Count(d => d is >= DayOfWeek.Monday and <= DayOfWeek.Friday);

        Assert.Equal(expectedWeekdays * 4, slots.Count);
        // No duplicate start times.
        Assert.Equal(slots.Count, slots.Select(s => s.StartsAt).Distinct().Count());
    }

    [Fact]
    public void Expand_DisabledDay_ProducesNothingThatDay()
    {
        var now = new DateTimeOffset(2026, 3, 2, 12, 0, 0, TimeSpan.Zero);
        var schedule = new WeeklySchedule
        {
            Id = Guid.NewGuid(),
            ResourceId = Resource,
            SlotDurationMinutes = 60,
            Capacity = 2,
            Days =
            [
                new WeeklyScheduleDay { Id = Guid.NewGuid(), Weekday = DayOfWeek.Monday, OpenTime = new(8, 0), CloseTime = new(12, 0), Enabled = false },
            ],
        };

        var slots = SlotWindowExpander.Expand(Resource, Tz, schedule, [], now, horizonDays: 14);
        Assert.Empty(slots);
    }

    // --- IsOrphanedScheduleSlot -------------------------------------------

    private static AvailabilitySlot ScheduleSlot(DateTimeOffset startsUtc, TimeSpan duration, bool blocked = false, params BookingStatus[] bookings) =>
        new()
        {
            Id = Guid.NewGuid(),
            ResourceId = Resource,
            StartsAt = startsUtc,
            EndsAt = startsUtc + duration,
            CapacityRemaining = 1,
            Origin = SlotOrigin.Schedule,
            IsBlocked = blocked,
            Bookings = bookings.Select(st => new Booking { Id = Guid.NewGuid(), Status = st, Seats = 1 }).ToList(),
        };

    [Fact]
    public void IsOrphaned_True_WhenOutsideEveryOpenWindow()
    {
        var schedule = Schedule(60, 2, (DayOfWeek.Monday, "08:00", "12:00"));
        // Monday 2026-03-02 15:00 local (21:00Z) — outside the 08-12 window.
        var slot = ScheduleSlot(new DateTimeOffset(2026, 3, 2, 21, 0, 0, TimeSpan.Zero), TimeSpan.FromHours(1));

        Assert.True(SlotWindowExpander.IsOrphanedScheduleSlot(slot, Tz, schedule));
    }

    [Fact]
    public void IsOrphaned_False_WhenInsideTheOpenWindow()
    {
        var schedule = Schedule(60, 2, (DayOfWeek.Monday, "08:00", "12:00"));
        var slot = ScheduleSlot(new DateTimeOffset(2026, 3, 2, 15, 0, 0, TimeSpan.Zero), TimeSpan.FromHours(1)); // 09:00 local

        Assert.False(SlotWindowExpander.IsOrphanedScheduleSlot(slot, Tz, schedule));
    }

    [Fact]
    public void IsOrphaned_False_WhenBookedEvenIfOutsideWindow()
    {
        var schedule = Schedule(60, 2, (DayOfWeek.Monday, "08:00", "12:00"));
        var slot = ScheduleSlot(
            new DateTimeOffset(2026, 3, 2, 21, 0, 0, TimeSpan.Zero), TimeSpan.FromHours(1),
            bookings: BookingStatus.Confirmed);

        Assert.False(SlotWindowExpander.IsOrphanedScheduleSlot(slot, Tz, schedule));
    }

    [Fact]
    public void IsOrphaned_False_ForAdhocOrBlockedSlots()
    {
        var schedule = Schedule(60, 2, (DayOfWeek.Monday, "08:00", "12:00"));
        var outside = new DateTimeOffset(2026, 3, 2, 21, 0, 0, TimeSpan.Zero);

        var adhoc = ScheduleSlot(outside, TimeSpan.FromHours(1));
        adhoc.Origin = SlotOrigin.Adhoc;
        Assert.False(SlotWindowExpander.IsOrphanedScheduleSlot(adhoc, Tz, schedule));

        var blocked = ScheduleSlot(outside, TimeSpan.FromHours(1), blocked: true);
        Assert.False(SlotWindowExpander.IsOrphanedScheduleSlot(blocked, Tz, schedule));
    }
}
