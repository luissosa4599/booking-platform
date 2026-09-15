namespace BookingEngine.Domain;

public static class SentNotificationType
{
    public const string Reminder = "reminder";
    public const string WaitlistSlotOpened = "waitlist_slot_opened";
    public const string BookingCancelledByHost = "booking_cancelled_by_host";
}

/// <summary>
/// Dedupe record: one row per (user, type, subject) the worker has already
/// pushed for. Checked before sending so a restart, a slow poll, or two
/// worker instances never double-notify the same person for the same thing.
///
/// Also doubles as the in-app notification feed's storage (GET /notifications)
/// — <see cref="ResourceName"/>/<see cref="SlotStartsAt"/> are snapshotted at
/// write time (not joined at read time) specifically so a notification still
/// displays sensibly even if the underlying booking/slot is later cancelled
/// or deleted. The frontend composes the actual Spanish sentence from
/// <see cref="Type"/> + these fields (same "backend stays ASCII, frontend owns
/// accented copy" split as `emptyContext` elsewhere in this API) — this class
/// never stores a pre-built display sentence.
/// </summary>
public class SentNotification
{
    public Guid Id { get; set; }

    public string UserId { get; set; } = string.Empty;

    /// <summary>One of the <see cref="SentNotificationType"/> constants.</summary>
    public string Type { get; set; } = string.Empty;

    public Guid? BookingId { get; set; }

    public Guid? AvailabilitySlotId { get; set; }

    /// <summary>Snapshot of the resource's name at send time. Nullable only
    /// for rows written before this column existed.</summary>
    public string? ResourceName { get; set; }

    /// <summary>Snapshot of the slot's start time at send time.</summary>
    public DateTimeOffset? SlotStartsAt { get; set; }

    /// <summary>Read state for the in-app notification center. Not related
    /// to whether a push was actually delivered — this is "the user has seen
    /// this in the app," set via POST /notifications/read-all.</summary>
    public bool IsRead { get; set; }

    public DateTimeOffset SentAt { get; set; }
}
