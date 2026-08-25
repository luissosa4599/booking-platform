using Serilog;

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .CreateLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);

    builder.Host.UseSerilog();

    builder.Services.AddOpenApi();

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

    var app = builder.Build();

    if (app.Environment.IsDevelopment())
    {
        app.MapOpenApi();
    }

    app.UseCors(AllowWebPolicy);

    app.MapGet("/health", () => Results.Ok(new { status = "ok" }))
        .WithName("HealthCheck");

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
