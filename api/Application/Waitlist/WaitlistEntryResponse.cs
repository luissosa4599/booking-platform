namespace BookingEngine.Api.Application.Waitlist;

public record WaitlistEntryResponse(
    Guid Id,
    Guid AvailabilitySlotId,
    string UserId,
    DateTimeOffset CreatedAt);
