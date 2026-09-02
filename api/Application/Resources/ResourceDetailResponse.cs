using BookingEngine.Api.Application.Availability;
using BookingEngine.Api.Application.ResourceTypes;

namespace BookingEngine.Api.Application.Resources;

public record ResourceDetailResponse(
    Guid Id,
    Guid ResourceTypeId,
    string ResourceTypeName,
    ResourceLabelsResponse Labels,
    Guid LocationId,
    string LocationName,
    string? LocationAddress,
    double? LocationLatitude,
    double? LocationLongitude,
    string Name,
    int Capacity,
    string? Description,
    IReadOnlyList<AvailabilitySlotResponse> UpcomingSlots);
