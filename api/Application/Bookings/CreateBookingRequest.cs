namespace BookingEngine.Api.Application.Bookings;

/// <summary>
/// <paramref name="RowVersion"/> is the slot's optimistic-concurrency token
/// (Postgres <c>xmin</c>) as the client last saw it. Optional: when supplied,
/// a mismatch is rejected with 409 before the write is attempted, so a client
/// acting on stale availability data doesn't silently book against it.
/// </summary>
public record CreateBookingRequest(
    Guid AvailabilitySlotId,
    string UserId,
    int Seats,
    uint? RowVersion = null);
