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

    public ICollection<AvailabilitySlot> AvailabilitySlots { get; set; } = new List<AvailabilitySlot>();
}
