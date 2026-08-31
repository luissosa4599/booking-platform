using BookingEngine.Api.Application.Auth;
using Google.Apis.Auth;

namespace BookingEngine.Api.Infrastructure.Auth;

/// <summary>
/// Real Google ID-token validation via <c>Google.Apis.Auth</c>: fetches and
/// caches Google's signing keys, checks the signature, expiry, issuer and that
/// the audience is one of our configured client IDs.
/// </summary>
public class GoogleIdTokenValidator(AuthOptions options, ILogger<GoogleIdTokenValidator> logger)
    : IGoogleIdTokenValidator
{
    public async Task<GoogleIdentity?> ValidateAsync(string idToken, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(idToken))
        {
            return null;
        }

        var settings = new GoogleJsonWebSignature.ValidationSettings();
        if (options.GoogleClientIds.Count > 0)
        {
            settings.Audience = options.GoogleClientIds;
        }

        try
        {
            var payload = await GoogleJsonWebSignature.ValidateAsync(idToken, settings);
            if (string.IsNullOrWhiteSpace(payload.Email) || !payload.EmailVerified)
            {
                logger.LogWarning("Google ID token rejected — email missing or unverified");
                return null;
            }

            return new GoogleIdentity(payload.Subject, payload.Email, payload.Name, payload.Picture);
        }
        catch (InvalidJwtException ex)
        {
            logger.LogWarning(ex, "Google ID token failed validation");
            return null;
        }
    }
}
