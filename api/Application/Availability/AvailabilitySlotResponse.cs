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
    uint RowVersion);
