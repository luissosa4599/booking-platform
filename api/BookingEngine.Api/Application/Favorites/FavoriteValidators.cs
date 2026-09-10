using FluentValidation;

namespace BookingEngine.Api.Application.Favorites;

public class CreateFavoriteRequestValidator : AbstractValidator<CreateFavoriteRequest>
{
    public CreateFavoriteRequestValidator()
    {
        RuleFor(x => x.ResourceId).NotEmpty();
    }
}
