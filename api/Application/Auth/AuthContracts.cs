namespace BookingEngine.Api.Application.Auth;

// --- Dev-only magic link (no mail sender; kept for local testing without Google) ---

public record RequestLinkRequest(string Email);

/// <summary>
/// In a real system the token would only be emailed. This is a portfolio stub:
/// there is no mail sender, so the dev response hands the token (and a ready
/// magic link) straight back to the caller.
/// </summary>
public record RequestLinkResponse(string Token, string MagicLink);

public record VerifyRequest(string Token);

// --- Google OAuth2 → first-party session ---

public record GoogleSignInRequest(string IdToken);

public record RefreshRequest(string RefreshToken);

public record LogoutRequest(string RefreshToken);

public record AuthUser(string Id, string Email, string? DisplayName, string? AvatarUrl);

/// <summary>
/// The session payload returned by <c>/auth/google</c>, <c>/auth/refresh</c>
/// and the dev <c>/auth/verify</c>.
/// </summary>
public record SessionResponse(
    string AccessToken,
    string RefreshToken,
    DateTimeOffset AccessTokenExpiresAt,
    AuthUser User);
