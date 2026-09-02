namespace BookingEngine.Domain;

/// <summary>
/// An Expo push token registered by a signed-in user's device. A user can have
/// several (multiple devices) — the worker fans a push out to all of them.
/// </summary>
public class PushToken
{
    public Guid Id { get; set; }

    public string UserId { get; set; } = string.Empty;

    public string ExpoPushToken { get; set; } = string.Empty;

    /// <summary>"ios" | "android" | "web" — informational only, not used to branch delivery.</summary>
    public string Platform { get; set; } = string.Empty;

    public DateTimeOffset UpdatedAt { get; set; }
}
