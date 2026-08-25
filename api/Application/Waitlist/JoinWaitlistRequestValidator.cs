using FluentValidation;

namespace BookingEngine.Api.Application.Waitlist;

public class JoinWaitlistRequestValidator : AbstractValidator<JoinWaitlistRequest>
{
    public JoinWaitlistRequestValidator()
    {
        RuleFor(x => x.AvailabilitySlotId).NotEmpty();
        RuleFor(x => x.UserId).NotEmpty().MaximumLength(200);
    }
}
