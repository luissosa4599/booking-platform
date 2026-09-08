using BookingEngine.Api.Application.ResourceTypes;

namespace BookingEngine.Api.Application.Owner;

// --- Responses -------------------------------------------------------------

public record OwnerSpaceSummary(
    Guid Id,
    string Name,
    string LocationName,
    string? LocationAddress,
    int UpcomingSlotCount,
    bool HasSchedule);

public record OwnerSlotResponse(
    Guid Id,
    DateTimeOffset StartsAt,
    DateTimeOffset EndsAt,
    int Capacity,
    int Booked,
    bool IsBlocked,
    string Origin);

public record WeeklyScheduleDayResponse(
    string Weekday,
    string OpenTime,
    string CloseTime,
    bool Enabled);

public record WeeklyScheduleResponse(
    int SlotDurationMinutes,
    int Capacity,
    IReadOnlyList<WeeklyScheduleDayResponse> Days);

public record OwnerSpaceDetailResponse(
    Guid Id,
    string Name,
    string? Description,
    int Capacity,
    Guid ResourceTypeId,
    string ResourceTypeName,
    ResourceLabelsResponse Labels,
    bool AllowsMultipleSeats,
    Guid LocationId,
    string LocationName,
    string? LocationAddress,
    double? LocationLatitude,
    double? LocationLongitude,
    string TimeZone,
    IReadOnlyList<ResourceImageResponse> Images,
    WeeklyScheduleResponse? Schedule,
    IReadOnlyList<OwnerSlotResponse> UpcomingSlots);

// --- Requests -------------------------------------------------------------

public record CreateSpaceRequest(
    string Name,
    string? Description,
    int Capacity,
    Guid ResourceTypeId,
    string LocationName,
    string? Address,
    string TimeZone,
    double? LocationLatitude = null,
    double? LocationLongitude = null);

public record UpdateSpaceRequest(
    string Name,
    string? Description,
    int Capacity,
    string? Address,
    double? LocationLatitude = null,
    double? LocationLongitude = null);

public record ScheduleDayInput(
    string Weekday,
    string OpenTime,
    string CloseTime,
    bool Enabled);

public record SetScheduleRequest(
    int SlotDurationMinutes,
    int Capacity,
    IReadOnlyList<ScheduleDayInput> Days);

public record AddSlotRequest(DateTimeOffset StartsAt, DateTimeOffset EndsAt, int Capacity);

public record BlockSlotRequest(bool Force = false);
