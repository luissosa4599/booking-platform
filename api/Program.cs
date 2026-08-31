using System.Threading.RateLimiting;
using BookingEngine.Api.Api.Endpoints;
using BookingEngine.Api.Application.Auth;
using BookingEngine.Api.Application.Bookings;
using BookingEngine.Api.Infrastructure;
using BookingEngine.Api.Infrastructure.Auth;
using BookingEngine.Api.Infrastructure.Seed;
using DotNetEnv;
using FluentValidation;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Serilog;

// ASP.NET Core doesn't read .env files on its own — without this, running
// `dotnet run` picks up nothing from api/.env and ConnectionStrings__Default
// stays empty (Npgsql then throws "ConnectionString property has not been
// initialized"). Only loads when the file exists, so it's a no-op in CI/
// production, where real environment variables are set directly and no
// .env file is deployed (it's gitignored).
if (File.Exists(".env"))
{
    Env.Load();
}

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .CreateLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);

    builder.Host.UseSerilog();

    builder.Services.AddOpenApi();

    builder.Services.AddDbContext<BookingEngineDbContext>(options =>
        options.UseNpgsql(builder.Configuration.GetConnectionString("Default")));

    builder.Services.AddValidatorsFromAssemblyContaining<CreateBookingRequestValidator>();

    // Auth: Google ID token is exchanged once for a first-party session
    // (short-lived JWT access token + rotating refresh token). See AuthEndpoints.
    var authOptions = new AuthOptions
    {
        Secret = builder.Configuration["AUTH_TOKEN_SECRET"] ?? AuthOptions.DevSecret,
        GoogleClientIds = (builder.Configuration["GOOGLE_CLIENT_ID"] ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries),
    };
    builder.Services.AddSingleton(authOptions);
    builder.Services.AddSingleton<SessionTokens>();
    builder.Services.AddScoped<IGoogleIdTokenValidator, GoogleIdTokenValidator>();

    builder.Services
        .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(options =>
        {
            options.MapInboundClaims = false;
            options.TokenValidationParameters =
                new SessionTokens(authOptions).ValidationParameters();
        });
    builder.Services.AddAuthorization();

    const string AllowWebPolicy = "AllowWeb";
    builder.Services.AddCors(options =>
    {
        options.AddPolicy(AllowWebPolicy, policy =>
        {
            if (builder.Environment.IsDevelopment())
            {
                // Dev only: the Expo web app can be served from any host/port
                // (localhost, a LAN IP for phone testing, a tunnel URL). Native
                // clients (Expo Go / a dev build) send no Origin and bypass CORS
                // entirely; this is purely so the browser build works from
                // wherever the dev server happens to be.
                policy.SetIsOriginAllowed(_ => true)
                    .AllowAnyMethod()
                    .AllowAnyHeader();
                return;
            }

            var allowedOrigins = new[]
            {
                "http://localhost:8081",
                builder.Configuration["FRONTEND_WEB_URL"],
            }
                .Where(origin => !string.IsNullOrWhiteSpace(origin))
                .Select(origin => origin!)
                .ToArray();

            policy.WithOrigins(allowedOrigins)
                .AllowAnyMethod()
                .AllowAnyHeader();
        });
    });

    // Not present before this task despite the assumption it was — added
    // here. Global fixed-window limiter, partitioned per client IP, so it
    // covers every endpoint (existing and new) without decorating each one.
    builder.Services.AddRateLimiter(options =>
    {
        options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
        options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
            RateLimitPartition.GetFixedWindowLimiter(
                partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                factory: _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 100,
                    Window = TimeSpan.FromMinutes(1),
                }));
    });

    var app = builder.Build();

    if (app.Environment.IsDevelopment())
    {
        app.MapOpenApi();
    }

    app.UseCors(AllowWebPolicy);
    app.UseRateLimiter();
    app.UseAuthentication();
    app.UseAuthorization();

    app.MapGet("/health", () => Results.Ok(new { status = "ok" }))
        .WithName("HealthCheck");

    app.MapAuthEndpoints();
    app.MapResourceTypesEndpoints();
    app.MapAvailabilityEndpoints();
    app.MapResourcesEndpoints();
    app.MapBookingsEndpoints();
    app.MapWaitlistEndpoints();

    if (app.Environment.IsDevelopment())
    {
        app.MapDevAuthEndpoints();

        app.MapPost("/dev/seed", async (BookingEngineDbContext db, ILogger<Program> logger) =>
        {
            var result = await DevSeeder.SeedAsync(db, logger);
            return Results.Ok(result);
        })
        .WithName("DevSeed");
    }

    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Host terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}

// Exposed so WebApplicationFactory<Program> in the test project can find it —
// top-level statements otherwise generate an internal Program class.
public partial class Program { }
