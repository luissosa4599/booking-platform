using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using BookingEngine.Domain;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace BookingEngine.Api.Application.Auth;

/// <summary>
/// Issues first-party session tokens: a short-lived signed JWT access token
/// (validated by the JwtBearer middleware) and an opaque, rotating refresh
/// token (only its hash is persisted). Google's ID token is exchanged for
/// these once, at sign-in — see <see cref="IGoogleIdTokenValidator"/>.
/// </summary>
public class SessionTokens(AuthOptions options)
{
    // HS256 needs a >=256-bit key; derive one from the configured secret so any
    // secret length works and issuing/validation stay in lockstep.
    private readonly SymmetricSecurityKey _key =
        new(SHA256.HashData(Encoding.UTF8.GetBytes(options.Secret)));

    public string IssueAccessToken(User user, DateTimeOffset now)
    {
        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = options.Issuer,
            Audience = options.Audience,
            IssuedAt = now.UtcDateTime,
            NotBefore = now.UtcDateTime,
            Expires = now.Add(options.AccessTokenLifetime).UtcDateTime,
            Claims = new Dictionary<string, object>
            {
                [JwtRegisteredClaimNames.Sub] = user.Id,
                [JwtRegisteredClaimNames.Email] = user.Email,
                [JwtRegisteredClaimNames.Name] = user.DisplayName ?? user.Email,
                [JwtRegisteredClaimNames.Jti] = Guid.NewGuid().ToString("N"),
            },
            SigningCredentials = new SigningCredentials(_key, SecurityAlgorithms.HmacSha256),
        };

        return new JsonWebTokenHandler().CreateToken(descriptor);
    }

    /// <summary>Returns the raw token (handed to the client once) and the hash to store.</summary>
    public static (string Raw, string Hash) NewRefreshToken()
    {
        var raw = Base64Url(RandomNumberGenerator.GetBytes(32));
        return (raw, HashRefreshToken(raw));
    }

    public static string HashRefreshToken(string raw) =>
        Convert.ToBase64String(SHA256.HashData(Encoding.UTF8.GetBytes(raw)));

    /// <summary>
    /// Token-validation parameters for the JwtBearer middleware — kept here so
    /// the API and the test host validate identically.
    /// </summary>
    public TokenValidationParameters ValidationParameters() => new()
    {
        ValidateIssuer = true,
        ValidIssuer = options.Issuer,
        ValidateAudience = true,
        ValidAudience = options.Audience,
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = _key,
        ValidateLifetime = true,
        ClockSkew = TimeSpan.FromSeconds(30),
        NameClaimType = ClaimTypes.NameIdentifier,
    };

    private static string Base64Url(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
