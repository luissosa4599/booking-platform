using FluentValidation;

namespace BookingEngine.Api.Application.Checkins;

public record CheckinRequest(string Code, bool Force = false);

public class CheckinRequestValidator : AbstractValidator<CheckinRequest>
{
    public CheckinRequestValidator()
    {
        RuleFor(x => x.Code).NotEmpty().MaximumLength(20);
    }
}

/// <summary>
/// One shape for every outcome. The frontend keys off HTTP status + <see cref="Status"/>:
/// confirmed / already_confirmed (200), unknown_code (404), wrong_space (403),
/// out_of_window (409). Booking/visit fields are null on the error variants.
/// </summary>
public record CheckinResponse(
    string Status,
    Guid? BookingId = null,
    string? Code = null,
    string? VisitorName = null,
    string? SpaceName = null,
    string? LocationName = null,
    DateTimeOffset? StartsAt = null,
    DateTimeOffset? EndsAt = null,
    int? Seats = null,
    DateTimeOffset? ConfirmedAt = null,
    string? Direction = null);
