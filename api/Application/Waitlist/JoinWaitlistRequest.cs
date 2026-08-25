namespace BookingEngine.Api.Application.Waitlist;

public record JoinWaitlistRequest(Guid AvailabilitySlotId, string UserId);
