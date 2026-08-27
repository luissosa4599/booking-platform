namespace BookingEngine.Api.Domain;

public class Booking
{
    public Guid Id { get; set; }

    public Guid AvailabilitySlotId { get; set; }

    public AvailabilitySlot AvailabilitySlot { get; set; } = null!;

    /// <summary>Placeholder until a real auth system exists — just an opaque string.</summary>
    public string UserId { get; set; } = string.Empty;

    public int Seats { get; set; }

    public BookingStatus Status { get; set; }

    /// <summary>
    /// Human-readable confirmation code shown on the confirmation and bookings
    /// screens (e.g. "SAL-8241"). Generated once at creation, unique — see
    /// BookingConfiguration. Kept even after cancellation.
    /// </summary>
    public string Code { get; set; } = string.Empty;

    /// <summary>Client-generated per booking attempt. Unique — see BookingConfiguration.</summary>
    public string IdempotencyKey { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }
}
