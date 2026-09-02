namespace BookingEngine.Api.Domain;

/// <summary>
/// An authenticated account. <see cref="Id"/> keeps the same derivation the
/// magic-link stub used — <c>guid(sha256(email)[..16])</c> — so bookings and
/// waitlist rows created before real auth still resolve to the same person once
/// they sign in with Google using the same email.
/// </summary>
public class User
{
    public string Id { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    /// <summary>Google's stable subject identifier (the <c>sub</c> claim). Null for dev magic-link users.</summary>
    public string? GoogleSub { get; set; }

    public string? DisplayName { get; set; }

    public string? AvatarUrl { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset LastSeenAt { get; set; }

    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
}
