using FluentValidation;

namespace BookingEngine.Api.Application.Validation;

/// <summary>
/// Runs the registered FluentValidation validator for <typeparamref name="T"/>
/// against the first matching endpoint argument before the handler runs.
/// Usage: `.AddEndpointFilter&lt;ValidationFilter&lt;TRequest&gt;&gt;()`.
/// </summary>
public class ValidationFilter<T> : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(
        EndpointFilterInvocationContext context,
        EndpointFilterDelegate next)
    {
        var argument = context.Arguments.OfType<T>().FirstOrDefault();
        if (argument is null)
        {
            return Results.BadRequest();
        }

        var validator = context.HttpContext.RequestServices.GetRequiredService<IValidator<T>>();
        var validationResult = await validator.ValidateAsync(argument);

        if (!validationResult.IsValid)
        {
            return Results.ValidationProblem(validationResult.ToDictionary());
        }

        return await next(context);
    }
}
