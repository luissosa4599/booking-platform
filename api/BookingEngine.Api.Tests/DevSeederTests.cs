using BookingEngine.Api.Infrastructure.Seed;
using BookingEngine.Domain;
using BookingEngine.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace BookingEngine.Api.Tests;

/// <summary>
/// Its own collection (and so its own Postgres container): the seeder writes
/// tens of thousands of slots and — in Reset mode — wipes every table, which
/// must never leak into the shared "Api" collection's data.
/// </summary>
[CollectionDefinition("Seeder")]
public class SeederCollection : ICollectionFixture<ApiTestFixture>;

[Collection("Seeder")]
public class DevSeederTests(ApiTestFixture fixture)
{
    [Fact]
    public async Task TopUp_KeepsBookingsAndOwnedSpaces_AndOnlyRefillsMissingSlots()
    {
        using var scope = fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();

        // Empty database -> TopUp creates the catalog from scratch.
        await DevSeeder.SeedAsync(db, NullLogger.Instance, SeedMode.TopUp);
        var seededIds = await db.Resources.Where(r => r.OwnerUserId == null).Select(r => r.Id).ToListAsync();
        Assert.NotEmpty(seededIds);

        // Real-user state that a reseed must not touch.
        var slot = await db.AvailabilitySlots
            .Where(s => seededIds.Contains(s.ResourceId) && s.StartsAt > DateTimeOffset.UtcNow)
            .OrderBy(s => s.StartsAt)
            .FirstAsync();
        var booking = new Booking
        {
            Id = Guid.NewGuid(),
            AvailabilitySlotId = slot.Id,
            UserId = "tester-1",
            Seats = 1,
            Status = BookingStatus.Confirmed,
            Code = "TST-0001",
            IdempotencyKey = Guid.NewGuid().ToString(),
            CreatedAt = DateTimeOffset.UtcNow,
        };
        db.Bookings.Add(booking);
        var type = await TestData.CreateResourceTypeAsync(db);
        var owned = await TestData.CreateOwnedResourceAsync(db, "host-1", type);
        await db.SaveChangesAsync();

        // Simulate an aging window: drop one resource's tail of slots.
        var aged = seededIds[0];
        var cutoff = DateTimeOffset.UtcNow.AddDays(30);
        var before = await db.AvailabilitySlots.CountAsync(s => s.ResourceId == aged && s.StartsAt > cutoff);
        await db.AvailabilitySlots.Where(s => s.ResourceId == aged && s.StartsAt > cutoff).ExecuteDeleteAsync();
        var totalBefore = await db.AvailabilitySlots.CountAsync();

        db.ChangeTracker.Clear();
        var result = await DevSeeder.SeedAsync(db, NullLogger.Instance, SeedMode.TopUp);

        Assert.True(await db.Bookings.AnyAsync(b => b.Id == booking.Id));
        Assert.True(await db.Resources.AnyAsync(r => r.Id == owned.Id));
        Assert.Equal(
            seededIds.OrderBy(x => x),
            (await db.Resources.Where(r => r.OwnerUserId == null).Select(r => r.Id).ToListAsync()).OrderBy(x => x));

        // The dropped tail is back, and nothing else got duplicated.
        Assert.Equal(before, await db.AvailabilitySlots.CountAsync(s => s.ResourceId == aged && s.StartsAt > cutoff));
        Assert.True(result.AvailabilitySlots >= before);
        Assert.Equal(totalBefore + result.AvailabilitySlots, await db.AvailabilitySlots.CountAsync());
        var duplicates = await db.AvailabilitySlots
            .Where(s => seededIds.Contains(s.ResourceId) && s.StartsAt > DateTimeOffset.UtcNow)
            .GroupBy(s => new { s.ResourceId, s.StartsAt })
            .Where(g => g.Count() > 1)
            .CountAsync();
        Assert.Equal(0, duplicates);
    }
}
