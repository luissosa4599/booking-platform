using FluentValidation;

namespace BookingEngine.Api.Application.Calendar;

public record CalendarConnectRequest(string Code, string CodeVerifier, string RedirectUri);

public record CalendarEventRequest(Guid BookingId);

public record CalendarStatusResponse(bool Connected, bool Available);

/// <summary>`status`: created | not_connected | not_found.</summary>
public record CalendarEventResponse(string Status, string? HtmlLink = null);

public class CalendarConnectRequestValidator : AbstractValidator<CalendarConnectRequest>
{
    public CalendarConnectRequestValidator()
    {
        RuleFor(x => x.Code).NotEmpty();
        RuleFor(x => x.CodeVerifier).NotEmpty();
        RuleFor(x => x.RedirectUri).NotEmpty();
    }
}

public class CalendarEventRequestValidator : AbstractValidator<CalendarEventRequest>
{
    public CalendarEventRequestValidator() => RuleFor(x => x.BookingId).NotEmpty();
}
