namespace BookingEngine.Api.Domain;

public class AvailabilitySlot
{
    public Guid Id { get; set; }

    public Guid ResourceId { get; set; }

    public Resource Resource { get; set; } = null!;

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset EndsAt { get; set; }

    public int CapacityRemaining { get; set; }

    /// <summary>
    /// Optimistic concurrency token. Mapped to PostgreSQL's `xmin` system
    /// column via .IsRowVersion() in Fluent API (Npgsql-specific convention —
    /// see AvailabilitySlotConfiguration) rather than a real column, so two
    /// concurrent bookings racing for the last seat can never both succeed.
    /// </summary>
    public uint RowVersion { get; set; }

    public ICollection<Booking> Bookings { get; set; } = new List<Booking>();

    public ICollection<WaitlistEntry> WaitlistEntries { get; set; } = new List<WaitlistEntry>();
}
