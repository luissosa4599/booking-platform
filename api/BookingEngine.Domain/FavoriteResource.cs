namespace BookingEngine.Domain;

/// <summary>
/// A resource a guest has saved as a favorite. One row per (user, resource) —
/// the unique index makes "favorite" a toggle, not an accumulating log. Like
/// <see cref="PushToken"/>, <c>UserId</c> is the opaque sub-claim string with no
/// FK to <see cref="User"/>.
/// </summary>
public class FavoriteResource
{
    public Guid Id { get; set; }

    public string UserId { get; set; } = string.Empty;

    public Guid ResourceId { get; set; }

    public Resource Resource { get; set; } = null!;

    public DateTimeOffset CreatedAt { get; set; }
}
