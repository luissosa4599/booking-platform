namespace BookingEngine.Domain;

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

    /// <summary>
    /// PBKDF2-SHA256 password hash (see <c>PasswordHasher</c>), null until the
    /// user registers with email+password or sets one via password recovery.
    /// A user who first signed in with Google can still add a password later —
    /// same <see cref="Id"/> derivation for both, so it's the same account.
    /// </summary>
    public string? PasswordHash { get; set; }

    public string? DisplayName { get; set; }

    public string? AvatarUrl { get; set; }

    /// <summary>Guest (books) or Host (publishes + scans). Self-upgrade only, no downgrade path yet.</summary>
    public AccountRole Role { get; set; } = AccountRole.Guest;

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset LastSeenAt { get; set; }

    /// <summary>
    /// Encrypted Google OAuth2 refresh token for the <c>calendar.events</c>
    /// scope — set when the user connects Google Calendar (a separate consent
    /// from sign-in). Null = not connected.
    /// </summary>
    public string? GoogleCalendarRefreshToken { get; set; }

    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
}
