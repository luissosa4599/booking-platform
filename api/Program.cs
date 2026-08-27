using System.Threading.RateLimiting;
using BookingEngine.Api.Api.Endpoints;
using BookingEngine.Api.Application.Bookings;
using BookingEngine.Api.Infrastructure;
using BookingEngine.Api.Infrastructure.Seed;
using DotNetEnv;
using FluentValidation;
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

    const string AllowWebPolicy = "AllowWeb";
    builder.Services.AddCors(options =>
    {
        options.AddPolicy(AllowWebPolicy, policy =>
        {
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
