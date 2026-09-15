namespace BookingEngine.Api.Application.Availability;

public record AvailabilitySlotResponse(
    Guid Id,
    Guid ResourceId,
    string ResourceName,
    Guid ResourceTypeId,
    string LocationName,
    DateTimeOffset StartsAt,
    DateTimeOffset EndsAt,
    int CapacityRemaining,
    uint RowVersion,
    // Straight-line metres from the caller's lat/lng — only populated when
    // sort=nearest with coordinates; null otherwise (and for resources whose
    // location has no coordinates).
    double? DistanceMeters = null,
    // The resource's location, so the client can recompute distance live as the
    // device moves without re-hitting this endpoint. Null when unset.
    double? LocationLatitude = null,
    double? LocationLongitude = null,
    // First seeded/uploaded photo (ResourceImage, ordered by Position), so
    // Explore/Map cards can show a real per-resource photo instead of one
    // fixed stock image per resource TYPE (`lib/stockImages.ts`'s
    // client-side fallback). Null for a host-published space with no photos
    // yet — the client falls back to the stock image in that case, same as
    // it already does for the detail screen's PhotoCarousel.
    string? ImageUrl = null);
