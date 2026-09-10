using BookingEngine.Infrastructure;
using BookingEngine.Worker;
using DotNetEnv;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Serilog;

// Same reasoning as api/BookingEngine.Api/Program.cs — .env is a dev-only
// convenience (this worker's own is api/BookingEngine.Worker/.env), a no-op
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
    // (BookingEngine.Api's `dotnet ef` commands are still the only
    // way migrations get created/applied; see CLAUDE.md).
    builder.Services.AddDbContext<BookingEngineDbContext>(options =>
        options.UseNpgsql(builder.Configuration.GetConnectionString("Default")));

    builder.Services.AddHttpClient<ExpoPushClient>();

    // Two shapes for the same three sweeps:
    //  - default: always-on BackgroundServices, each on its own PeriodicTimer.
    //    Used by local `docker compose` (and anyone who wants a long-running
    //    worker process).
    //  - WORKER_ONESHOT=true: run each sweep exactly once, then exit. The
    //    deployed shape — a scheduler (Cloud Scheduler) fires this as a job on
    //    an interval, so nothing stays running (and billing) between sweeps.
    var oneShot = builder.Configuration.GetValue<bool>("WORKER_ONESHOT");

    if (oneShot)
    {
        builder.Services.AddTransient<ScheduleExpansionService>();
        builder.Services.AddTransient<ReminderService>();
        builder.Services.AddTransient<WaitlistPromotionService>();
    }
    else
    {
        builder.Services.AddHostedService<ReminderService>();
        builder.Services.AddHostedService<WaitlistPromotionService>();
        builder.Services.AddHostedService<ScheduleExpansionService>();
    }

    var host = builder.Build();

    if (oneShot)
    {
        using var cts = new CancellationTokenSource(TimeSpan.FromMinutes(10));

        // Order matters: expand schedules first (it can create slots the other
        // two then act on), then reminders, then waitlist promotion. A failing
        // pass is logged and the next one still runs — same "a bad sweep
        // shouldn't sink the rest" stance as the long-running loops.
        var passes = new IOneShotPass[]
        {
            host.Services.GetRequiredService<ScheduleExpansionService>(),
            host.Services.GetRequiredService<ReminderService>(),
            host.Services.GetRequiredService<WaitlistPromotionService>(),
        };

        foreach (var pass in passes)
        {
            try
            {
                await pass.RunOnceAsync(cts.Token);
            }
            catch (Exception ex)
            {
                Log.Error(ex, "one-shot pass {Pass} failed", pass.GetType().Name);
            }
        }

        return;
    }

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
