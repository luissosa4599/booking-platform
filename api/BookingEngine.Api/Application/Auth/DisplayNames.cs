using System.Text.RegularExpressions;

namespace BookingEngine.Api.Application.Auth;

/// <summary>
/// A user-typed display name (email registration, profile edit). Google
/// Sign-In's name comes from the Google profile and doesn't go through here.
/// </summary>
public static partial class DisplayNames
{
    public const int MaxLength = 80;

    /// <summary>Trims and collapses inner whitespace; blank becomes null.</summary>
    public static string? Normalize(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return null;
        }

        return Whitespace().Replace(raw.Trim(), " ");
    }

    public static bool IsTooLong(string? normalized) => normalized is { Length: > MaxLength };

    [GeneratedRegex(@"\s+")]
    private static partial Regex Whitespace();
}
