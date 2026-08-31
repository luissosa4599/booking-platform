namespace BookingEngine.Api.Application.Auth;

/// <summary>
/// Auth configuration, bound from environment/appsettings in Program.cs. The
/// dev fallbacks keep the app runnable with no setup; a real deployment sets
/// AUTH_TOKEN_SECRET and GOOGLE_CLIENT_ID.
/// </summary>
public class AuthOptions
{
    public const string DevSecret = "tempo-dev-magic-link-secret";

    /// <summary>HMAC key for signing our own access tokens (and the dev magic link).</summary>
    public string Secret { get; set; } = DevSecret;

    public string Issuer { get; set; } = "tempo-api";

    public string Audience { get; set; } = "tempo-app";

    /// <summary>
    /// Accepted Google OAuth client IDs (web / iOS / Android) — the ID token's
    /// <c>aud</c> must match one of these. Comma-separated in config.
    /// </summary>
    public IReadOnlyList<string> GoogleClientIds { get; set; } = [];

    public TimeSpan AccessTokenLifetime { get; set; } = TimeSpan.FromMinutes(30);

    public TimeSpan RefreshTokenLifetime { get; set; } = TimeSpan.FromDays(30);
}
