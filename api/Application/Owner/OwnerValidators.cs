using System.Globalization;
using FluentValidation;

namespace BookingEngine.Api.Application.Owner;

public class CreateSpaceRequestValidator : AbstractValidator<CreateSpaceRequest>
{
    public CreateSpaceRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MinimumLength(3).MaximumLength(150);
        RuleFor(x => x.Description).MaximumLength(1000);
        RuleFor(x => x.Capacity).GreaterThan(0).LessThanOrEqualTo(60);
        RuleFor(x => x.ResourceTypeId).NotEmpty();
        RuleFor(x => x.LocationName).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Address).MaximumLength(300);
        RuleFor(x => x.TimeZone).NotEmpty().MaximumLength(100);

        RuleFor(x => x.LocationLatitude).InclusiveBetween(-90, 90)
            .When(x => x.LocationLatitude.HasValue);
        RuleFor(x => x.LocationLongitude).InclusiveBetween(-180, 180)
            .When(x => x.LocationLongitude.HasValue);
        RuleFor(x => x)
            .Must(x => x.LocationLatitude.HasValue == x.LocationLongitude.HasValue)
            .WithMessage("Latitude and longitude must be provided together.");
    }
}

public class UpdateSpaceRequestValidator : AbstractValidator<UpdateSpaceRequest>
{
    public UpdateSpaceRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MinimumLength(3).MaximumLength(150);
        RuleFor(x => x.Description).MaximumLength(1000);
        RuleFor(x => x.Capacity).GreaterThan(0).LessThanOrEqualTo(60);
        RuleFor(x => x.Address).MaximumLength(300);

        RuleFor(x => x.LocationLatitude).InclusiveBetween(-90, 90)
            .When(x => x.LocationLatitude.HasValue);
        RuleFor(x => x.LocationLongitude).InclusiveBetween(-180, 180)
            .When(x => x.LocationLongitude.HasValue);
        RuleFor(x => x)
            .Must(x => x.LocationLatitude.HasValue == x.LocationLongitude.HasValue)
            .WithMessage("Latitude and longitude must be provided together.");
    }
}

public class SetScheduleRequestValidator : AbstractValidator<SetScheduleRequest>
{
    private static readonly int[] AllowedDurations = [60, 90, 120];

    public SetScheduleRequestValidator()
    {
        RuleFor(x => x.SlotDurationMinutes)
            .Must(d => AllowedDurations.Contains(d))
            .WithMessage("Slot duration must be 60, 90 or 120 minutes.");
        RuleFor(x => x.Capacity).GreaterThan(0).LessThanOrEqualTo(60);
        RuleForEach(x => x.Days).ChildRules(day =>
        {
            day.RuleFor(d => d.Weekday)
                .Must(w => Enum.TryParse<DayOfWeek>(w, ignoreCase: true, out _))
                .WithMessage("Unknown weekday.");
            day.RuleFor(d => d.OpenTime)
                .Must(BeTime).WithMessage("Open time must be HH:mm.");
            day.RuleFor(d => d.CloseTime)
                .Must(BeTime).WithMessage("Close time must be HH:mm.");
            day.RuleFor(d => d)
                .Must(d => !d.Enabled || !BeTime(d.OpenTime) || !BeTime(d.CloseTime)
                    || TimeOnly.Parse(d.OpenTime, CultureInfo.InvariantCulture)
                        < TimeOnly.Parse(d.CloseTime, CultureInfo.InvariantCulture))
                .WithMessage("Open time must be before close time.");
        });
    }

    private static bool BeTime(string value) =>
        TimeOnly.TryParse(value, CultureInfo.InvariantCulture, out _);
}

public class AddSlotRequestValidator : AbstractValidator<AddSlotRequest>
{
    public AddSlotRequestValidator()
    {
        RuleFor(x => x.EndsAt).GreaterThan(x => x.StartsAt)
            .WithMessage("End time must be after start time.");
        RuleFor(x => x.Capacity).GreaterThan(0).LessThanOrEqualTo(60);
    }
}
