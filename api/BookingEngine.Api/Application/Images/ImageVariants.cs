using Microsoft.AspNetCore.WebUtilities;

namespace BookingEngine.Api.Application.Images;

/// <summary>
/// Right-sizes stored photo URLs for where they're shown. Seeded photos are
/// Unsplash URLs stored at <c>w=1200</c> (what the detail hero needs), but
/// Explore renders ~60 cards of 150px height at once — at full size that was
/// ~8.5 MB of images on first paint (2026-09-29 measurement), brutal on a
/// low-end phone. Unsplash's CDN resizes on the fly from the query string, so
/// list endpoints hand out a smaller variant. Done server-side on purpose: the
/// APK already installed on testers' phones picks it up with no new build.
///
/// Anything that isn't an Unsplash URL (host uploads on GCS, which has no
/// on-the-fly resizing) is returned unchanged.
/// </summary>
public static class ImageVariants
{
    /// <summary>Explore/map cards: ~360pt wide x 150pt, fine at 2x density.</summary>
    public static string? Card(string? url) => Resize(url, width: 720, quality: 60);

    /// <summary>Small square thumbnails (Reservas next-booking card).</summary>
    public static string? Thumb(string? url) => Resize(url, width: 240, quality: 60);

    private static string? Resize(string? url, int width, int quality)
    {
        if (string.IsNullOrEmpty(url)
            || !Uri.TryCreate(url, UriKind.Absolute, out var uri)
            || !string.Equals(uri.Host, "images.unsplash.com", StringComparison.OrdinalIgnoreCase))
        {
            return url;
        }

        var query = QueryHelpers.ParseQuery(uri.Query)
            .ToDictionary(kv => kv.Key, kv => (string?)kv.Value.ToString());
        query["w"] = width.ToString(System.Globalization.CultureInfo.InvariantCulture);
        query["q"] = quality.ToString(System.Globalization.CultureInfo.InvariantCulture);
        query.TryAdd("auto", "format");

        var baseUrl = uri.GetLeftPart(UriPartial.Path);
        return QueryHelpers.AddQueryString(baseUrl, query);
    }
}
