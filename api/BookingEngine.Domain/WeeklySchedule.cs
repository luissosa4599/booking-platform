namespace BookingEngine.Domain;

/// <summary>
/// A resource's recurring open-hours template. Duration and capacity are set
/// once for the whole space; only open/close times vary per weekday
/// (<see cref="WeeklyScheduleDay"/>). The expander turns this into concrete
/// <see cref="AvailabilitySlot"/> rows for the next ~14 days.
/// </summary>
public class WeeklySchedule
{
    public Guid Id { get; set; }

    public Guid ResourceId { get; set; }

    public Resource Resource { get; set; } = null!;

    public int SlotDurationMinutes { get; set; }

    public int Capacity { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    /// <summary>Up to 7 rows. A weekday with no row (or Enabled = false) is closed.</summary>
    public ICollection<WeeklyScheduleDay> Days { get; set; } = new List<WeeklyScheduleDay>();
}

public class WeeklyScheduleDay
{
    public Guid Id { get; set; }

    public Guid WeeklyScheduleId { get; set; }

    public WeeklySchedule WeeklySchedule { get; set; } = null!;

    public DayOfWeek Weekday { get; set; }

    public TimeOnly OpenTime { get; set; }

    public TimeOnly CloseTime { get; set; }

    public bool Enabled { get; set; }
}
