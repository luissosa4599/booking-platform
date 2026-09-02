namespace BookingEngine.Api.Application.Auth;

/// <summary>
/// Verifies a Google OAuth2 ID token (signature against Google's JWKS,
/// audience, issuer, expiry) and returns the identity it asserts. Abstracted
/// so tests can supply a fake — the real implementation talks to Google.
/// </summary>
public interface IGoogleIdTokenValidator
{
    Task<GoogleIdentity?> ValidateAsync(string idToken, CancellationToken ct = default);
}

public record GoogleIdentity(string Subject, string Email, string? Name, string? Picture);
