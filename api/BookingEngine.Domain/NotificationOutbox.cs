namespace BookingEngine.Domain;

public static class NotificationType
{
    public const string WaitlistSlotOpened = "waitlist_slot_opened";
}

/// <summary>
/// Transactional outbox: the API writes a row here in the *same* SaveChanges
/// as the event that caused it (e.g. a booking cancellation), so the event is
/// never lost even if the worker is down. The worker polls this table and
/// marks rows <see cref="ProcessedAt"/> once handled — see
/// WaitlistPromotionService.
/// </summary>
public class NotificationOutbox
{
    public Guid Id { get; set; }

    /// <summary>One of the <see cref="NotificationType"/> constants.</summary>
    public string Type { get; set; } = string.Empty;

    public Guid AvailabilitySlotId { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset? ProcessedAt { get; set; }

    public int Attempts { get; set; }
}
