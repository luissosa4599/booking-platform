using System.Security.Cryptography;
using System.Text;

namespace BookingEngine.Api.Application.Auth;

/// <summary>
/// Symmetric encryption for the stored Google Calendar refresh token. AES-256-GCM
/// with a key derived from <see cref="AuthOptions.Secret"/> the same way
/// <see cref="SessionTokens"/> derives its signing key — so rotating the secret
/// invalidates stored tokens (users reconnect), which is the safe failure mode.
/// </summary>
public sealed class CalendarTokenCipher
{
    private readonly byte[] _key;

    public CalendarTokenCipher(AuthOptions options)
    {
        _key = SHA256.HashData(Encoding.UTF8.GetBytes(options.Secret));
    }

    /// <summary>Returns base64 of nonce(12) || tag(16) || ciphertext.</summary>
    public string Encrypt(string plaintext)
    {
        var plain = Encoding.UTF8.GetBytes(plaintext);
        var nonce = RandomNumberGenerator.GetBytes(AesGcm.NonceByteSizes.MaxSize);
        var tag = new byte[AesGcm.TagByteSizes.MaxSize];
        var cipher = new byte[plain.Length];

        using var aes = new AesGcm(_key, AesGcm.TagByteSizes.MaxSize);
        aes.Encrypt(nonce, plain, cipher, tag);

        var packed = new byte[nonce.Length + tag.Length + cipher.Length];
        Buffer.BlockCopy(nonce, 0, packed, 0, nonce.Length);
        Buffer.BlockCopy(tag, 0, packed, nonce.Length, tag.Length);
        Buffer.BlockCopy(cipher, 0, packed, nonce.Length + tag.Length, cipher.Length);
        return Convert.ToBase64String(packed);
    }

    /// <summary>Null when the input isn't valid ciphertext for the current key
    /// (e.g. the secret rotated) — the caller treats that as "not connected".</summary>
    public string? Decrypt(string packedBase64)
    {
        try
        {
            var packed = Convert.FromBase64String(packedBase64);
            const int nonceLen = 12;
            const int tagLen = 16;
            if (packed.Length < nonceLen + tagLen)
            {
                return null;
            }

            var nonce = packed[..nonceLen];
            var tag = packed[nonceLen..(nonceLen + tagLen)];
            var cipher = packed[(nonceLen + tagLen)..];
            var plain = new byte[cipher.Length];

            using var aes = new AesGcm(_key, tagLen);
            aes.Decrypt(nonce, cipher, tag, plain);
            return Encoding.UTF8.GetString(plain);
        }
        catch (CryptographicException)
        {
            return null;
        }
        catch (FormatException)
        {
            return null;
        }
    }
}
