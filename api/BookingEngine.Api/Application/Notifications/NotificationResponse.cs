namespace BookingEngine.Api.Application.Notifications;

/// <summary>
/// One row of the in-app notification feed. Deliberately NOT a pre-built
/// display sentence — <see cref="Type"/> is one of the
/// BookingEngine.Domain.SentNotificationType constants (ASCII, an internal
/// key) and the frontend composes the actual accented Spanish copy from
/// <see cref="Type"/> + <see cref="ResourceName"/> + <see cref="SlotStartsAt"/>,
/// same "backend stays ASCII, frontend owns copy" split as `emptyContext`
/// elsewhere in this API.
/// </summary>
public record NotificationResponse(
    Guid Id,
    string Type,
    string? ResourceName,
    DateTimeOffset? SlotStartsAt,
    Guid? BookingId,
    Guid? AvailabilitySlotId,
    bool IsRead,
    DateTimeOffset SentAt);

public record NotificationsResponse(
    List<NotificationResponse> Notifications,
    int UnreadCount);
