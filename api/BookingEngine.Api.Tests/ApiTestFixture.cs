using BookingEngine.Infrastructure;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Testcontainers.PostgreSql;

namespace BookingEngine.Api.Tests;

/// <summary>
/// Spins up a real, ephemeral Postgres container (via Testcontainers) once
/// for the whole "Api" test collection, applies migrations, and exposes a
/// WebApplicationFactory wired to point at it. Optimistic concurrency relies
/// on Postgres's `xmin` system column — an in-memory or SQLite provider
/// wouldn't exercise the same code path, so integration tests need a real
/// Postgres. Requires Docker; GitHub Actions' ubuntu-latest runners have it
/// out of the box, no extra CI config needed.
/// </summary>
public class ApiTestFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _container = new PostgreSqlBuilder("postgres:16-alpine").Build();

    public WebApplicationFactory<Program> Factory { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        // Must be a real process environment variable, set before the factory
        // below ever builds the host — Program.cs reads RATE_LIMIT_PER_MINUTE
        // eagerly (unlike ConnectionStrings:Default, which is read lazily
        // inside AddDbContext's options lambda), so a WebApplicationFactory
        // ConfigureAppConfiguration override arrives too late to be seen. The
        // whole "Api" collection shares one TestServer/quota bucket (the
        // global rate limiter partitions by client IP, and every in-process
        // test request looks like the same IP) — same reasoning as the e2e
        // suite/CI setting this high, see CLAUDE.md. Without it, enough tests
        // in one run trip 429s that have nothing to do with the endpoint
        // under test.
        Environment.SetEnvironmentVariable("RATE_LIMIT_PER_MINUTE", "100000");

        await _container.StartAsync();

        Factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Development");
            builder.ConfigureAppConfiguration((_, config) =>
            {
                config.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ConnectionStrings:Default"] = _container.GetConnectionString(),
                });
            });
        });

        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();
        await db.Database.MigrateAsync();
    }

    public async Task DisposeAsync()
    {
        await Factory.DisposeAsync();
        await _container.DisposeAsync();
    }
}

[CollectionDefinition("Api")]
public class ApiCollection : ICollectionFixture<ApiTestFixture>;
