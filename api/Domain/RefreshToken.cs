namespace BookingEngine.Api.Domain;

/// <summary>
/// A long-lived refresh token, rotated on every use. Only the SHA-256 hash of
/// the token value is stored — a database leak never yields a usable token.
/// </summary>
public class RefreshToken
{
    public Guid Id { get; set; }

    public string UserId { get; set; } = string.Empty;

    public User User { get; set; } = null!;

    /// <summary>Base64 of SHA-256(token). The raw token is only ever held by the client.</summary>
    public string TokenHash { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset ExpiresAt { get; set; }

    public DateTimeOffset? RevokedAt { get; set; }

    /// <summary>Set when this token was rotated — points at the replacement's hash for audit.</summary>
    public string? ReplacedByTokenHash { get; set; }

    public bool IsActive(DateTimeOffset now) => RevokedAt is null && ExpiresAt > now;
}
