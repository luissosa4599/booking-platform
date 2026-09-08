namespace BookingEngine.Domain;

public class Resource
{
    public Guid Id { get; set; }

    public Guid ResourceTypeId { get; set; }

    public ResourceType ResourceType { get; set; } = null!;

    public Guid LocationId { get; set; }

    public Location Location { get; set; } = null!;

    public string Name { get; set; } = string.Empty;

    public int Capacity { get; set; }

    public string? Description { get; set; }

    /// <summary>The host who published this resource. Null for seeded/legacy rows.</summary>
    public string? OwnerUserId { get; set; }

    /// <summary>Recurring open-hours template. Null until the host sets one. One per resource.</summary>
    public WeeklySchedule? WeeklySchedule { get; set; }

    public ICollection<AvailabilitySlot> AvailabilitySlots { get; set; } = new List<AvailabilitySlot>();
}
