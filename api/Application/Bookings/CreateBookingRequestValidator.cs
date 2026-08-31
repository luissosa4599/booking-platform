using FluentValidation;

namespace BookingEngine.Api.Application.Bookings;

public class CreateBookingRequestValidator : AbstractValidator<CreateBookingRequest>
{
    public CreateBookingRequestValidator()
    {
        RuleFor(x => x.AvailabilitySlotId).NotEmpty();
        RuleFor(x => x.Seats).GreaterThan(0);
    }
}
