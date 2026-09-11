using System.Security.Cryptography;

namespace BookingEngine.Api.Application.Auth;

/// <summary>
/// PBKDF2-SHA256 password hashing, hand-rolled the same way as
/// <see cref="MagicLinkTokens"/> and <see cref="CalendarTokenCipher"/> rather
/// than pulling in ASP.NET Core Identity for one class — this app doesn't use
/// Identity's UserManager/DbContext model at all. Format:
/// "{iterations}.{saltBase64}.{hashBase64}".
/// </summary>
public static class PasswordHasher
{
    // OWASP's 2023 minimum recommendation for PBKDF2-HMAC-SHA256.
    private const int Iterations = 210_000;
    private const int SaltSize = 16;
    private const int HashSize = 32;

    public static bool IsValidPassword(string password) =>
        !string.IsNullOrWhiteSpace(password) && password.Length >= 8;

    public static string Hash(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(SaltSize);
        var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, Iterations, HashAlgorithmName.SHA256, HashSize);
        return $"{Iterations}.{Convert.ToBase64String(salt)}.{Convert.ToBase64String(hash)}";
    }

    /// <summary>Constant-time compare. False for a malformed/empty hash (e.g. a
    /// Google-only account with no password set yet) rather than throwing.</summary>
    public static bool Verify(string password, string? encodedHash)
    {
        if (string.IsNullOrEmpty(encodedHash))
        {
            return false;
        }

        var parts = encodedHash.Split('.');
        if (parts.Length != 3 || !int.TryParse(parts[0], out var iterations))
        {
            return false;
        }

        byte[] salt, expected;
        try
        {
            salt = Convert.FromBase64String(parts[1]);
            expected = Convert.FromBase64String(parts[2]);
        }
        catch (FormatException)
        {
            return false;
        }

        var actual = Rfc2898DeriveBytes.Pbkdf2(password, salt, iterations, HashAlgorithmName.SHA256, expected.Length);
        return CryptographicOperations.FixedTimeEquals(actual, expected);
    }
}
