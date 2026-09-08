using System.Net.Http.Json;
using BookingEngine.Api.Application.Availability;
using BookingEngine.Domain;
using BookingEngine.Infrastructure;
using Microsoft.Extensions.DependencyInjection;

namespace BookingEngine.Api.Tests;

[Collection("Api")]
public class AvailabilitySortTests(ApiTestFixture fixture)
{
    // Mexico City-ish reference point.
    private const double OriginLat = 19.4326;
    private const double OriginLng = -99.1332;

    [Fact]
    public async Task SortNearest_OrdersByDistance_WithNullCoordsLast_AndDistanceMeters()
    {
        using var scope = fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();

        var type = await TestData.CreateResourceTypeAsync(db);
        var near = await SlotAsync(db, type, "AAA near", cap: 4, lat: 19.4330, lng: -99.1340);
        var far = await SlotAsync(db, type, "BBB far", cap: 4, lat: 19.6000, lng: -99.3000);
        var noCoords = await SlotAsync(db, type, "CCC nocoords", cap: 4, lat: null, lng: null);

        var body = await Query(db, type.Id,
            $"&sort=nearest&lat={OriginLat}&lng={OriginLng}");

        var ids = body.Slots.Select(s => s.Id).ToList();
        Assert.Equal(near.Id, ids[0]);
        Assert.Equal(far.Id, ids[1]);
        Assert.Equal(noCoords.Id, ids[2]);

        var nearRow = body.Slots.First(s => s.Id == near.Id);
        Assert.NotNull(nearRow.DistanceMeters);
        Assert.InRange(nearRow.DistanceMeters!.Value, 0, 2000);
        Assert.Null(body.Slots.First(s => s.Id == noCoords.Id).DistanceMeters);
    }

    [Fact]
    public async Task SortNearest_WithoutCoordinates_FallsBackToSoonest()
    {
        using var scope = fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();

        var type = await TestData.CreateResourceTypeAsync(db);
        var later = await SlotAsync(db, type, "ZZZ", cap: 4, lat: 19.5, lng: -99.5,
            startsAt: DateTimeOffset.UtcNow.AddHours(6));
        var sooner = await SlotAsync(db, type, "AAA", cap: 4, lat: 19.9, lng: -99.9,
            startsAt: DateTimeOffset.UtcNow.AddHours(2));

        var body = await Query(db, type.Id, "&sort=nearest");

        Assert.Equal(sooner.Id, body.Slots[0].Id);
        Assert.Equal(later.Id, body.Slots[1].Id);
        Assert.All(body.Slots, s => Assert.Null(s.DistanceMeters));
    }

    [Fact]
    public async Task SortName_IsAlphabetical()
    {
        using var scope = fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();

        var type = await TestData.CreateResourceTypeAsync(db);
        var zeta = await SlotAsync(db, type, "Zzz Sala", cap: 4);
        var alpha = await SlotAsync(db, type, "Aaa Sala", cap: 4);

        var body = await Query(db, type.Id, "&sort=name");

        var names = body.Slots.Select(s => s.ResourceName).ToList();
        Assert.Equal(alpha.Resource.Name, names[0]);
        Assert.Equal(zeta.Resource.Name, names[1]);
    }

    [Fact]
    public async Task SortCapacity_IsDescending()
    {
        using var scope = fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();

        var type = await TestData.CreateResourceTypeAsync(db);
        var small = await SlotAsync(db, type, "small", cap: 2);
        var big = await SlotAsync(db, type, "big", cap: 20);

        var body = await Query(db, type.Id, "&sort=capacity");

        Assert.Equal(big.Id, body.Slots[0].Id);
        Assert.Equal(small.Id, body.Slots[1].Id);
    }

    private async Task<AvailabilityResponse> Query(BookingEngineDbContext db, Guid typeId, string extra)
    {
        var from = DateTimeOffset.UtcNow.ToString("O");
        var to = DateTimeOffset.UtcNow.AddDays(1).ToString("O");
        var client = fixture.Factory.CreateClient();
        var body = await client.GetFromJsonAsync<AvailabilityResponse>(
            $"/availability?resourceTypeId={typeId}&from={Uri.EscapeDataString(from)}&to={Uri.EscapeDataString(to)}{extra}");
        return body!;
    }

    private static async Task<AvailabilitySlot> SlotAsync(
        BookingEngineDbContext db,
        ResourceType type,
        string name,
        int cap,
        double? lat = null,
        double? lng = null,
        DateTimeOffset? startsAt = null)
    {
        var location = new Location
        {
            Id = Guid.NewGuid(),
            Name = $"Loc {Guid.NewGuid():N}",
            TimeZone = "America/Mexico_City",
            Latitude = lat,
            Longitude = lng,
        };
        var resource = new Resource
        {
            Id = Guid.NewGuid(),
            ResourceTypeId = type.Id,
            Location = location,
            Name = $"{name} {Guid.NewGuid():N}",
            Capacity = cap,
        };
        var start = startsAt ?? DateTimeOffset.UtcNow.AddHours(3);
        var slot = new AvailabilitySlot
        {
            Id = Guid.NewGuid(),
            Resource = resource,
            StartsAt = start,
            EndsAt = start.AddMinutes(90),
            CapacityRemaining = Math.Max(cap, 1),
        };
        db.AvailabilitySlots.Add(slot);
        await db.SaveChangesAsync();
        return slot;
    }
}
