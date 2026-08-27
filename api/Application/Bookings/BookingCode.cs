using System.Text;

namespace BookingEngine.Api.Application.Bookings;

/// <summary>
/// Builds the human-readable confirmation code (e.g. "SAL-8241"): a 3-letter
/// prefix derived from the resource name plus four digits. Deterministic prefix,
/// random suffix — uniqueness is checked against the DB by the caller.
/// </summary>
public static class BookingCode
{
    public static string Prefix(string resourceName)
    {
        var letters = new StringBuilder();
        foreach (var c in resourceName)
        {
            if (char.IsLetter(c))
            {
                letters.Append(char.ToUpperInvariant(c));
            }

            if (letters.Length == 3)
            {
                break;
            }
        }

        // Pad short names ("A3") so the prefix is always 3 chars.
        while (letters.Length < 3)
        {
            letters.Append('X');
        }

        return letters.ToString();
    }

    public static string Generate(string resourceName, Random random) =>
        $"{Prefix(resourceName)}-{random.Next(1000, 10000)}";
}
