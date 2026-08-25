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
