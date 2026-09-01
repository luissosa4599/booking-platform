using FluentValidation;

namespace BookingEngine.Api.Application.Devices;

public class RegisterDeviceRequestValidator : AbstractValidator<RegisterDeviceRequest>
{
    public RegisterDeviceRequestValidator()
    {
        RuleFor(x => x.ExpoPushToken).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Platform).NotEmpty().MaximumLength(20);
    }
}
