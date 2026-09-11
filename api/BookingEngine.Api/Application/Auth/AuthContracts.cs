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

// --- Email + password ---

public record RegisterRequest(string Email, string Password);

public record LoginRequest(string Email, string Password);

public record ForgotPasswordRequest(string Email);

/// <summary>
/// Always the same generic message regardless of whether the email is
/// registered (don't leak which emails have accounts). In Development only,
/// also carries the raw token/link — there's no mail sender wired for local
/// testing, same fallback the dev magic link uses.
/// </summary>
public record ForgotPasswordResponse(
    string Message,
    string? DebugToken = null,
    string? DebugResetLink = null);

public record ResetPasswordRequest(string Token, string NewPassword);

// --- Google OAuth2 → first-party session ---

public record GoogleSignInRequest(string IdToken);

public record RefreshRequest(string RefreshToken);

public record LogoutRequest(string RefreshToken);

public record AuthUser(string Id, string Email, string? DisplayName, string? AvatarUrl, string Role);

/// <summary>
/// The session payload returned by <c>/auth/google</c>, <c>/auth/refresh</c>
/// and the dev <c>/auth/verify</c>.
/// </summary>
public record SessionResponse(
    string AccessToken,
    string RefreshToken,
    DateTimeOffset AccessTokenExpiresAt,
    AuthUser User);
