using BookingEngine.Infrastructure;
using BookingEngine.Worker;
using DotNetEnv;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Serilog;

// Same reasoning as api/Program.cs — .env is dev-only convenience, a no-op
// when the file doesn't exist (CI/prod set real env vars directly).
if (File.Exists(".env"))
{
    Env.Load();
}

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .CreateLogger();

try
{
    var builder = Host.CreateApplicationBuilder(args);

    builder.Services.AddSerilog();

    // Same database as the API — this worker owns no migrations of its own
    // (api/BookingEngine.Api.csproj's `dotnet ef` commands are still the only
    // way migrations get created/applied; see CLAUDE.md).
    builder.Services.AddDbContext<BookingEngineDbContext>(options =>
        options.UseNpgsql(builder.Configuration.GetConnectionString("Default")));

    builder.Services.AddHttpClient<ExpoPushClient>();

    builder.Services.AddHostedService<ReminderService>();
    builder.Services.AddHostedService<WaitlistPromotionService>();

    var host = builder.Build();
    host.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Worker host terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}
