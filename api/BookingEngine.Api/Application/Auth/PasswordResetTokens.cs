using System.Security.Cryptography;
using System.Text;

namespace BookingEngine.Api.Application.Auth;

/// <summary>
/// Stateless HMAC-signed password-reset token — same shape as
/// <see cref="MagicLinkTokens"/> (no database row, the token carries
/// everything needed to validate it), but with a "reset:" payload prefix so a
/// leaked magic-link token can never be replayed here even though both share
/// the same signing secret: the payloads simply don't overlap.
/// </summary>
public static class PasswordResetTokens
{
    private static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(30);
    private const string Prefix = "reset:";

    public static string Issue(string email, string secret, DateTimeOffset now)
    {
        var expires = now.Add(Lifetime).ToUnixTimeSeconds();
        var payload = $"{Prefix}{email.Trim().ToLowerInvariant()}\n{expires}";
        var payloadBytes = Encoding.UTF8.GetBytes(payload);
        var sig = Sign(payloadBytes, secret);
        return $"{Base64Url(payloadBytes)}.{Base64Url(sig)}";
    }

    public static bool TryValidate(
        string token,
        string secret,
        DateTimeOffset now,
        out string email)
    {
        email = string.Empty;
        var parts = token.Split('.');
        if (parts.Length != 2)
        {
            return false;
        }

        byte[] payloadBytes;
        byte[] providedSig;
        try
        {
            payloadBytes = FromBase64Url(parts[0]);
            providedSig = FromBase64Url(parts[1]);
        }
        catch (FormatException)
        {
            return false;
        }

        var expectedSig = Sign(payloadBytes, secret);
        if (!CryptographicOperations.FixedTimeEquals(providedSig, expectedSig))
        {
            return false;
        }

        var payload = Encoding.UTF8.GetString(payloadBytes).Split('\n');
        if (payload.Length != 2 || !payload[0].StartsWith(Prefix, StringComparison.Ordinal))
        {
            return false;
        }
        if (!long.TryParse(payload[1], out var expiresUnix))
        {
            return false;
        }
        if (DateTimeOffset.FromUnixTimeSeconds(expiresUnix) < now)
        {
            return false;
        }

        email = payload[0][Prefix.Length..];
        return true;
    }

    private static byte[] Sign(byte[] payload, string secret) =>
        HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), payload);

    private static string Base64Url(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static byte[] FromBase64Url(string value)
    {
        var padded = value.Replace('-', '+').Replace('_', '/');
        padded += (padded.Length % 4) switch { 2 => "==", 3 => "=", _ => "" };
        return Convert.FromBase64String(padded);
    }
}
