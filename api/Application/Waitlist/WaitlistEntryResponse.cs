namespace BookingEngine.Api.Application.Waitlist;

/// <summary>Returned from POST /waitlist. <paramref name="Position"/> is 1-indexed.</summary>
public record WaitlistEntryResponse(
    Guid Id,
    Guid AvailabilitySlotId,
    string UserId,
    DateTimeOffset CreatedAt,
    int Position);

/// <summary>
/// GET /waitlist — flattened with resource/location/time like MyBookingResponse,
/// so the "Reservas" screen's waitlist section renders without a round-trip per entry.
/// </summary>
public record WaitlistEntryDetailResponse(
    Guid Id,
    Guid AvailabilitySlotId,
    string ResourceName,
    string LocationName,
    DateTimeOffset StartsAt,
    DateTimeOffset EndsAt,
    int Position);
