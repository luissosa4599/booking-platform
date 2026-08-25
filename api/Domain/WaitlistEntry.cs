namespace BookingEngine.Api.Domain;

public class WaitlistEntry
{
    public Guid Id { get; set; }

    public Guid AvailabilitySlotId { get; set; }

    public AvailabilitySlot AvailabilitySlot { get; set; } = null!;

    public string UserId { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset? NotifiedAt { get; set; }
}
