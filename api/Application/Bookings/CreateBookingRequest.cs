namespace BookingEngine.Api.Application.Bookings;

public record CreateBookingRequest(Guid AvailabilitySlotId, string UserId, int Seats);
