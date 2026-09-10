using System.Security.Cryptography;
using System.Text;

namespace BookingEngine.Api.Application.Auth;

/// <summary>
/// Issues and validates the stub magic-link token: an HMAC-signed
/// `base64url(payload).base64url(signature)` string where the payload is
/// `email\nexpiresAtUnixSeconds`. No database, no email — enough to demonstrate
/// the flow and give each email a stable user id.
/// </summary>
public static class MagicLinkTokens
{
    private static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(15);

    public static bool IsValidEmail(string email) =>
        !string.IsNullOrWhiteSpace(email) &&
        System.Text.RegularExpressions.Regex.IsMatch(
            email.Trim(),
            @"^[^@\s]+@[^@\s]+\.[^@\s]+$");

    public static string Issue(string email, string secret, DateTimeOffset now)
    {
        var expires = now.Add(Lifetime).ToUnixTimeSeconds();
        var payload = $"{email.Trim().ToLowerInvariant()}\n{expires}";
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
        if (payload.Length != 2 || !long.TryParse(payload[1], out var expiresUnix))
        {
            return false;
        }

        if (DateTimeOffset.FromUnixTimeSeconds(expiresUnix) < now)
        {
            return false;
        }

        email = payload[0];
        return true;
    }

    /// <summary>Stable user id for an email — same email always maps to the same id.</summary>
    public static string UserIdFor(string email)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(email.Trim().ToLowerInvariant()));
        return new Guid(hash.AsSpan(0, 16)).ToString("D");
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
