namespace BookingEngine.Domain;

public class AvailabilitySlot
{
    public Guid Id { get; set; }

    public Guid ResourceId { get; set; }

    public Resource Resource { get; set; } = null!;

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset EndsAt { get; set; }

    public int CapacityRemaining { get; set; }

    /// <summary>
    /// Host-closed. A blocked slot stays in the table (and visible to the host,
    /// with an "Abrir" affordance) but is filtered out of every guest-facing
    /// read (GET /availability, GET /resources/{id}, booking alternatives).
    /// </summary>
    public bool IsBlocked { get; set; }

    /// <summary>
    /// Whether this slot came from the resource's weekly schedule (regenerated
    /// by the expander) or was added by hand. Only <see cref="SlotOrigin.Schedule"/>
    /// slots with no bookings are ever auto-deleted.
    /// </summary>
    public SlotOrigin Origin { get; set; } = SlotOrigin.Adhoc;

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
