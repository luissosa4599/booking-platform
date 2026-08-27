using BookingEngine.Api.Application.Auth;

namespace BookingEngine.Api.Api.Endpoints;

public static class AuthEndpoints
{
    // Stub secret — this is a portfolio demo with no real user data. A real
    // deployment would set AUTH_TOKEN_SECRET to something private.
    private const string DefaultSecret = "cupo-dev-magic-link-secret";

    public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/auth/request-link", (
            RequestLinkRequest request,
            IConfiguration config,
            ILogger<Program> logger) =>
        {
            if (!MagicLinkTokens.IsValidEmail(request.Email))
            {
                return Results.BadRequest(new { message = "Enter a valid email address." });
            }

            var secret = config["AUTH_TOKEN_SECRET"] ?? DefaultSecret;
            var token = MagicLinkTokens.Issue(request.Email, secret, DateTimeOffset.UtcNow);
            var configuredFrontend = config["FRONTEND_WEB_URL"];
            var frontend = string.IsNullOrWhiteSpace(configuredFrontend)
                ? "http://localhost:8081"
                : configuredFrontend;

            logger.LogInformation("Magic link requested for {Email} (no mail sent — stub)", request.Email);

            // No email is sent — the dev caller gets the token directly.
            return Results.Ok(new RequestLinkResponse(
                token,
                $"{frontend}/auth/verify?token={Uri.EscapeDataString(token)}"));
        })
        .WithName("RequestMagicLink");

        app.MapPost("/auth/verify", (
            VerifyRequest request,
            IConfiguration config) =>
        {
            var secret = config["AUTH_TOKEN_SECRET"] ?? DefaultSecret;
            if (!MagicLinkTokens.TryValidate(request.Token, secret, DateTimeOffset.UtcNow, out var email))
            {
                return Results.BadRequest(new { message = "This link is invalid or has expired." });
            }

            return Results.Ok(new VerifyResponse(MagicLinkTokens.UserIdFor(email), email));
        })
        .WithName("VerifyMagicLink");
    }
}
