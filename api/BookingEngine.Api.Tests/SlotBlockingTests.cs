using System.Net;
using System.Net.Http.Json;
using BookingEngine.Domain;
using BookingEngine.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace BookingEngine.Api.Tests;

[Collection("Api")]
public class SlotBlockingTests(ApiTestFixture fixture)
{
    private async Task<(string hostId, Guid spaceId, Guid slotId)> SeedOwnedSlotAsync(int capacity = 4)
    {
        using var scope = fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();
        var hostId = $"host-{Guid.NewGuid():N}";
        var type = await TestData.CreateResourceTypeAsync(db);
        var resource = await TestData.CreateOwnedResourceAsync(db, hostId, type);
        var start = DateTimeOffset.UtcNow.AddHours(3);
        var slot = new AvailabilitySlot
        {
            Id = Guid.NewGuid(),
            ResourceId = resource.Id,
            StartsAt = start,
            EndsAt = start.AddMinutes(90),
            CapacityRemaining = capacity,
            Origin = SlotOrigin.Adhoc,
        };
        db.AvailabilitySlots.Add(slot);
        await db.SaveChangesAsync();
        return (hostId, resource.Id, slot.Id);
    }

    private async Task AddConfirmedBookingAsync(Guid slotId, string userId)
    {
        using var scope = fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();
        var slot = await db.AvailabilitySlots.FirstAsync(s => s.Id == slotId);
        slot.CapacityRemaining -= 1;
        db.Bookings.Add(new Booking
        {
            Id = Guid.NewGuid(),
            AvailabilitySlotId = slotId,
            UserId = userId,
            Seats = 1,
            Status = BookingStatus.Confirmed,
            Code = $"BLK-{Random.Shared.Next(1000, 9999)}",
            IdempotencyKey = Guid.NewGuid().ToString(),
            CreatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task Block_NoBookings_HidesSlotFromAvailability_UnblockRestores()
    {
        var (hostId, spaceId, slotId) = await SeedOwnedSlotAsync();
        var host = fixture.CreateAuthenticatedClient(hostId, role: AccountRole.Host);

        var block = await host.PostAsJsonAsync($"/owner/spaces/{spaceId}/slots/{slotId}/block", new { force = false });
        Assert.Equal(HttpStatusCode.NoContent, block.StatusCode);

        Assert.False(await SlotVisibleAsync(spaceId, slotId));

        var unblock = await host.PostAsJsonAsync($"/owner/spaces/{spaceId}/slots/{slotId}/unblock", new { });
        Assert.Equal(HttpStatusCode.NoContent, unblock.StatusCode);
        Assert.True(await SlotVisibleAsync(spaceId, slotId));
    }

    [Fact]
    public async Task Block_WithBookings_NoForce_Returns409WithCount()
    {
        var (hostId, spaceId, slotId) = await SeedOwnedSlotAsync();
        await AddConfirmedBookingAsync(slotId, "guest-a");
        await AddConfirmedBookingAsync(slotId, "guest-b");
        var host = fixture.CreateAuthenticatedClient(hostId, role: AccountRole.Host);

        var response = await host.PostAsJsonAsync($"/owner/spaces/{spaceId}/slots/{slotId}/block", new { force = false });
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<Conflict>();
        Assert.Equal(2, body!.Bookings);
    }

    [Fact]
    public async Task Block_WithForce_CancelsBookings_AndWritesOneOutboxRow()
    {
        var (hostId, spaceId, slotId) = await SeedOwnedSlotAsync();
        await AddConfirmedBookingAsync(slotId, "guest-c");
        await AddConfirmedBookingAsync(slotId, "guest-d");
        var host = fixture.CreateAuthenticatedClient(hostId, role: AccountRole.Host);

        var response = await host.PostAsJsonAsync($"/owner/spaces/{spaceId}/slots/{slotId}/block", new { force = true });
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        using var scope = fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();

        var cancelled = await db.Bookings.CountAsync(b => b.AvailabilitySlotId == slotId && b.Status == BookingStatus.Cancelled);
        Assert.Equal(2, cancelled);

        var outbox = await db.NotificationOutbox.CountAsync(
            o => o.AvailabilitySlotId == slotId && o.Type == NotificationType.BookingCancelledByHost);
        Assert.Equal(1, outbox);
    }

    [Fact]
    public async Task Block_OtherHostsSlot_Returns404()
    {
        var (_, spaceId, slotId) = await SeedOwnedSlotAsync();
        var stranger = fixture.CreateAuthenticatedClient($"host-{Guid.NewGuid():N}", role: AccountRole.Host);

        var response = await stranger.PostAsJsonAsync($"/owner/spaces/{spaceId}/slots/{slotId}/block", new { force = false });
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task AddSlot_ThenDelete_Works_ButDeleteWithBookingIs409()
    {
        var (hostId, spaceId, _) = await SeedOwnedSlotAsync();
        var host = fixture.CreateAuthenticatedClient(hostId, role: AccountRole.Host);

        var start = DateTimeOffset.UtcNow.AddDays(2);
        var add = await host.PostAsJsonAsync($"/owner/spaces/{spaceId}/slots", new
        {
            startsAt = start,
            endsAt = start.AddMinutes(60),
            capacity = 3,
        });
        Assert.Equal(HttpStatusCode.OK, add.StatusCode);
        var detail = await add.Content.ReadFromJsonAsync<Detail>();
        var newSlot = detail!.UpcomingSlots.Single(s => s.Origin == "Adhoc" && s.StartsAt == start);

        var del = await host.DeleteAsync($"/owner/spaces/{spaceId}/slots/{newSlot.Id}");
        Assert.Equal(HttpStatusCode.NoContent, del.StatusCode);
    }

    private async Task<bool> SlotVisibleAsync(Guid resourceId, Guid slotId)
    {
        var client = fixture.Factory.CreateClient();
        var detail = await client.GetFromJsonAsync<Detail>($"/resources/{resourceId}");
        return detail!.UpcomingSlots.Any(s => s.Id == slotId);
    }

    private record Conflict(int Bookings);
    private record Slot(Guid Id, DateTimeOffset StartsAt, string Origin);
    private record Detail(Slot[] UpcomingSlots);
}
