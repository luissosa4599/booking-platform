using System.Security.Cryptography;
using System.Text;

namespace BookingEngine.Api.Application.Auth;

/// <summary>
/// Stateless HMAC-signed password-reset token — same shape as
/// <see cref="MagicLinkTokens"/> (no database row, the token carries
/// everything needed to validate it), but with a "reset:" payload prefix so a
/// leaked magic-link token can never be replayed here even though both share
/// the same signing secret: the payloads simply don't overlap.
///
/// Single-use without a table: the payload carries a stamp derived from the
/// account's password hash at issue time. Resetting the password changes the
/// hash, so every link issued before it stops validating — the one just used
/// included.
/// </summary>
public static class PasswordResetTokens
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(30);
    private const string Prefix = "reset:";

    public static string Issue(string email, string? passwordHash, string secret, DateTimeOffset now)
    {
        var expires = now.Add(Lifetime).ToUnixTimeSeconds();
        var stamp = StampFor(passwordHash, secret);
        var payload = $"{Prefix}{email.Trim().ToLowerInvariant()}\n{expires}\n{stamp}";
        var payloadBytes = Encoding.UTF8.GetBytes(payload);
        var sig = Sign(payloadBytes, secret);
        return $"{Base64Url(payloadBytes)}.{Base64Url(sig)}";
    }

    public static bool TryValidate(
        string token,
        string secret,
        DateTimeOffset now,
        out string email,
        out string stamp)
    {
        email = string.Empty;
        stamp = string.Empty;
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
        if (payload.Length != 3 || !payload[0].StartsWith(Prefix, StringComparison.Ordinal))
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
        stamp = payload[2];
        return true;
    }

    /// <summary>
    /// Whether a token's stamp still matches the account's current password
    /// hash — false once the password has changed since the token was issued.
    /// </summary>
    public static bool StampMatches(string stamp, string? passwordHash, string secret) =>
        CryptographicOperations.FixedTimeEquals(
            Encoding.ASCII.GetBytes(stamp),
            Encoding.ASCII.GetBytes(StampFor(passwordHash, secret)));

    // Keyed (not a bare hash of the hash) so the link in an email reveals
    // nothing about the stored credential.
    private static string StampFor(string? passwordHash, string secret)
    {
        var mac = HMACSHA256.HashData(
            Encoding.UTF8.GetBytes(secret),
            Encoding.UTF8.GetBytes($"reset-stamp:{passwordHash ?? string.Empty}"));
        return Base64Url(mac[..12]);
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
