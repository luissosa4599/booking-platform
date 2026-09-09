using System.Net;
using System.Net.Http.Json;
using BookingEngine.Domain;
using BookingEngine.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace BookingEngine.Api.Tests;

[Collection("Api")]
public class OwnerEndpointsTests(ApiTestFixture fixture)
{
    private async Task<Guid> TypeIdAsync(bool multiSeat = true)
    {
        using var scope = fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();
        var type = await TestData.CreateResourceTypeAsync(db, multiSeat);
        return type.Id;
    }

    private static object CreateSpaceBody(Guid typeId, int capacity = 6, string name = "Sala X") => new
    {
        name,
        capacity,
        resourceTypeId = typeId,
        locationName = "Edificio Test",
        address = "Calle 1",
        timeZone = "America/Mexico_City",
    };

    [Fact]
    public async Task PostSpaces_WithGuestToken_Returns403()
    {
        var typeId = await TypeIdAsync();
        var guest = fixture.CreateAuthenticatedClient("guest-1", role: AccountRole.Guest);

        var response = await guest.PostAsJsonAsync("/owner/spaces", CreateSpaceBody(typeId));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task PostSpaces_AsHost_SetsOwnerOnBothLocationAndResource()
    {
        var typeId = await TypeIdAsync();
        var host = fixture.CreateAuthenticatedClient("host-1", role: AccountRole.Host);

        var response = await host.PostAsJsonAsync("/owner/spaces", CreateSpaceBody(typeId));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var detail = await response.Content.ReadFromJsonAsync<SpaceDetail>();

        using var scope = fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();
        var resource = await db.Resources.Include(r => r.Location).FirstAsync(r => r.Id == detail!.Id);

        Assert.Equal("host-1", resource.OwnerUserId);
        Assert.Equal("host-1", resource.Location.OwnerUserId);
    }

    [Fact]
    public async Task PostSpaces_IndividualType_ForcesCapacityToOne()
    {
        var typeId = await TypeIdAsync(multiSeat: false);
        var host = fixture.CreateAuthenticatedClient("host-2", role: AccountRole.Host);

        var response = await host.PostAsJsonAsync("/owner/spaces", CreateSpaceBody(typeId, capacity: 12));
        var detail = await response.Content.ReadFromJsonAsync<SpaceDetail>();

        Assert.Equal(1, detail!.Capacity);
    }

    [Fact]
    public async Task GetSpaces_IsScopedToCaller_And404sForOthers()
    {
        var typeId = await TypeIdAsync();
        var alice = fixture.CreateAuthenticatedClient("alice", role: AccountRole.Host);
        var bob = fixture.CreateAuthenticatedClient("bob", role: AccountRole.Host);

        var created = await alice.PostAsJsonAsync("/owner/spaces", CreateSpaceBody(typeId, name: "Alice space"));
        var aliceSpace = await created.Content.ReadFromJsonAsync<SpaceDetail>();

        var bobList = await bob.GetFromJsonAsync<SpaceSummary[]>("/owner/spaces");
        Assert.DoesNotContain(bobList!, s => s.Id == aliceSpace!.Id);

        var bobPeek = await bob.GetAsync($"/owner/spaces/{aliceSpace!.Id}");
        Assert.Equal(HttpStatusCode.NotFound, bobPeek.StatusCode);
    }

    [Fact]
    public async Task PutSchedule_GeneratesSlots_VisibleInAvailabilityAndResourceDetail()
    {
        var typeId = await TypeIdAsync();
        var host = fixture.CreateAuthenticatedClient("host-sched", role: AccountRole.Host);
        var created = await host.PostAsJsonAsync("/owner/spaces", CreateSpaceBody(typeId, name: "Scheduled space"));
        var space = await created.Content.ReadFromJsonAsync<SpaceDetail>();

        var putResp = await host.PutAsJsonAsync($"/owner/spaces/{space!.Id}/schedule", new
        {
            slotDurationMinutes = 60,
            capacity = 4,
            days = AllWeek("08:00", "18:00"),
        });
        Assert.Equal(HttpStatusCode.OK, putResp.StatusCode);
        var refreshed = await putResp.Content.ReadFromJsonAsync<SpaceDetail>();
        Assert.NotEmpty(refreshed!.UpcomingSlots);

        // Guest-facing endpoints see the generated slots.
        var from = DateTimeOffset.UtcNow.ToString("O");
        var to = DateTimeOffset.UtcNow.AddDays(20).ToString("O");
        var avail = await host.GetFromJsonAsync<AvailabilityBody>(
            $"/availability?from={Uri.EscapeDataString(from)}&to={Uri.EscapeDataString(to)}&q=Scheduled%20space");
        Assert.NotEmpty(avail!.Slots);

        var resDetail = await host.GetFromJsonAsync<ResourceDetailBody>($"/resources/{space.Id}");
        Assert.NotEmpty(resDetail!.UpcomingSlots);
    }

    [Fact]
    public async Task PutSchedule_NarrowingHours_PrunesUnbookedSlots_ButNotBookedOnes()
    {
        var typeId = await TypeIdAsync();
        var host = fixture.CreateAuthenticatedClient("host-prune", role: AccountRole.Host);
        var created = await host.PostAsJsonAsync("/owner/spaces", CreateSpaceBody(typeId, name: "Prune space"));
        var space = await created.Content.ReadFromJsonAsync<SpaceDetail>();

        await host.PutAsJsonAsync($"/owner/spaces/{space!.Id}/schedule", new
        {
            slotDurationMinutes = 60,
            capacity = 4,
            days = AllWeek("08:00", "20:00"),
        });

        Guid bookedSlotId;
        int wideCount;
        using (var scope = fixture.Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();
            var slots = await db.AvailabilitySlots
                .Where(s => s.ResourceId == space.Id)
                .OrderByDescending(s => s.StartsAt)
                .ToListAsync();
            wideCount = slots.Count;

            // Book the latest slot — it must survive the narrowing regardless
            // of whether it falls inside the new (narrower) window.
            var target = slots.First();
            bookedSlotId = target.Id;
            db.Bookings.Add(new Booking
            {
                Id = Guid.NewGuid(),
                AvailabilitySlotId = target.Id,
                UserId = "some-guest",
                Seats = 1,
                Status = BookingStatus.Confirmed,
                Code = $"PRN-{Random.Shared.Next(1000, 9999)}",
                IdempotencyKey = Guid.NewGuid().ToString(),
                CreatedAt = DateTimeOffset.UtcNow,
            });
            target.CapacityRemaining -= 1;
            await db.SaveChangesAsync();
        }

        // Narrow to mornings only.
        await host.PutAsJsonAsync($"/owner/spaces/{space.Id}/schedule", new
        {
            slotDurationMinutes = 60,
            capacity = 4,
            days = AllWeek("08:00", "12:00"),
        });

        using (var scope = fixture.Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();
            var remaining = await db.AvailabilitySlots
                .Where(s => s.ResourceId == space.Id)
                .CountAsync();

            Assert.True(remaining < wideCount, "narrowing the schedule should prune unbooked slots");
            Assert.True(await db.AvailabilitySlots.AnyAsync(s => s.Id == bookedSlotId),
                "a booked slot is never pruned");
        }
    }

    [Fact]
    public async Task PutSchedule_IsIdempotent()
    {
        var typeId = await TypeIdAsync();
        var host = fixture.CreateAuthenticatedClient("host-idem", role: AccountRole.Host);
        var created = await host.PostAsJsonAsync("/owner/spaces", CreateSpaceBody(typeId, name: "Idem space"));
        var space = await created.Content.ReadFromJsonAsync<SpaceDetail>();
        var body = new { slotDurationMinutes = 90, capacity = 6, days = AllWeek("09:00", "17:00") };

        var first = await host.PutAsJsonAsync($"/owner/spaces/{space!.Id}/schedule", body);
        var firstDetail = await first.Content.ReadFromJsonAsync<SpaceDetail>();
        var second = await host.PutAsJsonAsync($"/owner/spaces/{space.Id}/schedule", body);
        var secondDetail = await second.Content.ReadFromJsonAsync<SpaceDetail>();

        Assert.Equal(firstDetail!.UpcomingSlots.Length, secondDetail!.UpcomingSlots.Length);
    }

    [Fact]
    public async Task PostAndPatchSpace_RoundTripsCoordinates()
    {
        var typeId = await TypeIdAsync();
        var host = fixture.CreateAuthenticatedClient("coord-host", role: AccountRole.Host);

        var createBody = new
        {
            name = "Sala Mapa",
            capacity = 4,
            resourceTypeId = typeId,
            locationName = "Edificio Mapa",
            address = "Calle 1",
            timeZone = "America/Mexico_City",
            locationLatitude = 19.4326,
            locationLongitude = -99.1332,
        };
        var created = await host.PostAsJsonAsync("/owner/spaces", createBody);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var detail = await created.Content.ReadFromJsonAsync<SpaceDetail>();
        Assert.Equal(19.4326, detail!.LocationLatitude);
        Assert.Equal(-99.1332, detail.LocationLongitude);

        using (var scope = fixture.Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();
            var loc = await db.Resources.Include(r => r.Location).Where(r => r.Id == detail.Id)
                .Select(r => r.Location).FirstAsync();
            Assert.Equal(19.4326, loc.Latitude);
            Assert.Equal(-99.1332, loc.Longitude);
        }

        var patched = await host.PatchAsJsonAsync($"/owner/spaces/{detail.Id}", new
        {
            name = "Sala Mapa",
            capacity = 4,
            address = "Calle 2",
            locationLatitude = 20.0,
            locationLongitude = -100.0,
        });
        Assert.Equal(HttpStatusCode.OK, patched.StatusCode);
        var after = await patched.Content.ReadFromJsonAsync<SpaceDetail>();
        Assert.Equal(20.0, after!.LocationLatitude);
        Assert.Equal(-100.0, after.LocationLongitude);
    }

    [Fact]
    public async Task PostSpace_WithOnlyLatitude_Is400()
    {
        var typeId = await TypeIdAsync();
        var host = fixture.CreateAuthenticatedClient("coord-host-2", role: AccountRole.Host);

        var response = await host.PostAsJsonAsync("/owner/spaces", new
        {
            name = "Sala Incompleta",
            capacity = 4,
            resourceTypeId = typeId,
            locationName = "Edificio",
            timeZone = "America/Mexico_City",
            locationLatitude = 19.4,
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostSpace_WithOutOfRangeLatitude_Is400()
    {
        var typeId = await TypeIdAsync();
        var host = fixture.CreateAuthenticatedClient("coord-host-3", role: AccountRole.Host);

        var response = await host.PostAsJsonAsync("/owner/spaces", new
        {
            name = "Sala Polar",
            capacity = 4,
            resourceTypeId = typeId,
            locationName = "Edificio",
            timeZone = "America/Mexico_City",
            locationLatitude = 120.0,
            locationLongitude = 10.0,
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private static object[] AllWeek(string open, string close) =>
        Enum.GetValues<DayOfWeek>()
            .Select(d => (object)new
            {
                weekday = d.ToString(),
                openTime = open,
                closeTime = close,
                enabled = d is >= DayOfWeek.Monday and <= DayOfWeek.Friday,
            })
            .ToArray();

    private record SpaceSummary(Guid Id, string Name);
    private record Slot(Guid Id, DateTimeOffset StartsAt);
    private record SpaceDetail(
        Guid Id, string Name, int Capacity, Slot[] UpcomingSlots,
        double? LocationLatitude = null, double? LocationLongitude = null);
    private record AvailabilityBody(Slot[] Slots);
    private record ResourceDetailBody(Slot[] UpcomingSlots);
}
