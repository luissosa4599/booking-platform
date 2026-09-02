namespace BookingEngine.Domain;

public static class SentNotificationType
{
    public const string Reminder = "reminder";
    public const string WaitlistSlotOpened = "waitlist_slot_opened";
}

/// <summary>
/// Dedupe record: one row per (user, type, subject) the worker has already
/// pushed for. Checked before sending so a restart, a slow poll, or two
/// worker instances never double-notify the same person for the same thing.
/// </summary>
public class SentNotification
{
    public Guid Id { get; set; }

    public string UserId { get; set; } = string.Empty;

    /// <summary>One of the <see cref="SentNotificationType"/> constants.</summary>
    public string Type { get; set; } = string.Empty;

    public Guid? BookingId { get; set; }

    public Guid? AvailabilitySlotId { get; set; }

    public DateTimeOffset SentAt { get; set; }
}
