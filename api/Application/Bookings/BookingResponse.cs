namespace BookingEngine.Api.Application.Bookings;

public record BookingResponse(
    Guid Id,
    Guid AvailabilitySlotId,
    string UserId,
    int Seats,
    string Status,
    string IdempotencyKey,
    DateTimeOffset CreatedAt);

/// <summary>Body for 409 Conflict — the slot's capacity/version changed since the client read it.</summary>
public record BookingConflictResponse(string Message, Guid AvailabilitySlotId);

/// <summary>
/// GET /bookings — flattened with resource/location like AvailabilitySlotResponse,
/// so the "Mis reservas" screen doesn't need a second round-trip per booking.
/// </summary>
public record MyBookingResponse(
    Guid Id,
    Guid AvailabilitySlotId,
    Guid ResourceId,
    string ResourceName,
    string LocationName,
    DateTimeOffset StartsAt,
    DateTimeOffset EndsAt,
    int Seats,
    string Status);
