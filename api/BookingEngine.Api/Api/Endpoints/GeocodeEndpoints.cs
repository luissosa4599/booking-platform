using BookingEngine.Api.Infrastructure.Geocoding;

namespace BookingEngine.Api.Api.Endpoints;

public static class GeocodeEndpoints
{
    public static void MapGeocodeEndpoints(this IEndpointRouteBuilder app)
    {
        // Thin proxy over Google reverse-geocoding for the owner map picker.
        // `address` is null when no server key is configured or the lookup
        // finds nothing — the client falls back to manual entry.
        app.MapGet("/geocode/reverse", async (
            double lat,
            double lng,
            GeocodingClient client,
            CancellationToken ct) =>
        {
            if (lat is < -90 or > 90 || lng is < -180 or > 180)
            {
                return Results.BadRequest(new { message = "Coordinates out of range." });
            }

            var address = await client.ReverseAsync(lat, lng, ct);
            return Results.Ok(new { address });
        })
        .RequireAuthorization()
        .WithName("ReverseGeocode");
    }
}
