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
    double? LocationLongitude = null);
