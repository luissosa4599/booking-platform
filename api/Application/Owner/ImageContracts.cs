using FluentValidation;

namespace BookingEngine.Api.Application.Owner;

public record UploadUrlRequest(string ContentType);

public record UploadUrlResponse(string UploadUrl, string PublicUrl);

public record AddImageRequest(string Url);

public record ReorderImagesRequest(IReadOnlyList<Guid> ImageIds);

public record ResourceImageResponse(Guid Id, string Url, int Position);

public class UploadUrlRequestValidator : AbstractValidator<UploadUrlRequest>
{
    private static readonly string[] Allowed = ["image/jpeg", "image/png", "image/webp"];

    public UploadUrlRequestValidator()
    {
        RuleFor(x => x.ContentType)
            .Must(ct => Allowed.Contains(ct))
            .WithMessage("Content type must be image/jpeg, image/png or image/webp.");
    }
}

public class AddImageRequestValidator : AbstractValidator<AddImageRequest>
{
    public AddImageRequestValidator()
    {
        RuleFor(x => x.Url).NotEmpty().MaximumLength(600);
    }
}

public class ReorderImagesRequestValidator : AbstractValidator<ReorderImagesRequest>
{
    public ReorderImagesRequestValidator()
    {
        RuleFor(x => x.ImageIds).NotEmpty();
    }
}
