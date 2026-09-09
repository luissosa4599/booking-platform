using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace BookingEngine.Api.Infrastructure.Geocoding;

/// <summary>
/// Reverse-geocoding proxy for the owner map picker. Lives server-side, not in
/// the app: Google's Geocoding *web-service* API cannot be restricted by HTTP
/// referrer (only by server IP, or not at all), so a key that can call it must
/// never ship in a web bundle or an RN binary. <c>GOOGLE_MAPS_SERVER_KEY</c> is
/// IP-restricted and stays here.
/// </summary>
public class GeocodingClient(HttpClient httpClient, IConfiguration config, ILogger<GeocodingClient> logger)
{
    private readonly string? _key = config["GOOGLE_MAPS_SERVER_KEY"];

    public bool Enabled => !string.IsNullOrWhiteSpace(_key);

    /// <summary>
    /// A formatted street address for the coordinates, or null on any failure /
    /// empty result / missing key. Never throws — the picker degrades to manual
    /// address entry.
    /// </summary>
    public async Task<string?> ReverseAsync(double lat, double lng, CancellationToken ct = default)
    {
        if (!Enabled)
        {
            return null;
        }

        var latText = lat.ToString(CultureInfo.InvariantCulture);
        var lngText = lng.ToString(CultureInfo.InvariantCulture);
        var url = $"/maps/api/geocode/json?latlng={latText},{lngText}&language=es&key={_key}";

        try
        {
            using var response = await httpClient.GetAsync(url, ct);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Geocode API returned {Status}", response.StatusCode);
                return null;
            }

            var body = await response.Content.ReadFromJsonAsync<GeocodeResponse>(cancellationToken: ct);
            if (body is null || body.Status != "OK" || body.Results is not { Count: > 0 })
            {
                return null;
            }

            return body.Results[0].FormattedAddress;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Geocode request threw");
            return null;
        }
    }

    private record GeocodeResponse(
        [property: JsonPropertyName("status")] string Status,
        [property: JsonPropertyName("results")] List<GeocodeResult>? Results);

    private record GeocodeResult(
        [property: JsonPropertyName("formatted_address")] string FormattedAddress);
}
