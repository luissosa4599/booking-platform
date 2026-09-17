using System.Net;
using System.Net.Http.Json;
using BookingEngine.Api.Application.Waitlist;
using BookingEngine.Infrastructure;
using Microsoft.Extensions.DependencyInjection;

namespace BookingEngine.Api.Tests;

[Collection("Api")]
public class WaitlistTests(ApiTestFixture fixture)
{
    [Fact]
    public async Task PostWaitlist_FullSlot_AssignsIncreasingPositions()
    {
        using var scope = fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();
        var slot = await TestData.CreateSlotAsync(db, capacityRemaining: 0);

        var first = await fixture.CreateAuthenticatedClient("user-a")
            .PostAsJsonAsync("/waitlist", new { availabilitySlotId = slot.Id });
        var second = await fixture.CreateAuthenticatedClient("user-b")
            .PostAsJsonAsync("/waitlist", new { availabilitySlotId = slot.Id });

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.Created, second.StatusCode);

        var firstBody = await first.Content.ReadFromJsonAsync<WaitlistEntryResponse>();
        var secondBody = await second.Content.ReadFromJsonAsync<WaitlistEntryResponse>();

        Assert.Equal(1, firstBody!.Position);
        Assert.Equal(2, secondBody!.Position);
    }

    [Fact]
    public async Task PostWaitlist_SameUserTwice_IsIdempotent()
    {
        using var scope = fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();
        var slot = await TestData.CreateSlotAsync(db, capacityRemaining: 0);

        var client = fixture.CreateAuthenticatedClient("repeat-user");
        var body = new { availabilitySlotId = slot.Id };

        var first = await client.PostAsJsonAsync("/waitlist", body);
        var second = await client.PostAsJsonAsync("/waitlist", body);

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);

        var list = await client.GetFromJsonAsync<List<WaitlistEntryDetailResponse>>("/waitlist");
        Assert.Single(list!, e => e.AvailabilitySlotId == slot.Id);
    }

    [Fact]
    public async Task PostWaitlist_SlotWithCapacity_IsRejected()
    {
        using var scope = fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();
        var slot = await TestData.CreateSlotAsync(db, capacityRemaining: 3);

        var response = await fixture.CreateAuthenticatedClient("user-a")
            .PostAsJsonAsync("/waitlist", new { availabilitySlotId = slot.Id });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostWaitlist_WithoutToken_Is401()
    {
        using var scope = fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();
        var slot = await TestData.CreateSlotAsync(db, capacityRemaining: 0);

        var response = await fixture.Factory.CreateClient()
            .PostAsJsonAsync("/waitlist", new { availabilitySlotId = slot.Id });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetWaitlist_ReturnsEntriesWithPositionAndResource()
    {
        using var scope = fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();
        var slot = await TestData.CreateSlotAsync(db, capacityRemaining: 0);

        await fixture.CreateAuthenticatedClient("ahead")
            .PostAsJsonAsync("/waitlist", new { availabilitySlotId = slot.Id });
        var mineClient = fixture.CreateAuthenticatedClient("mine");
        await mineClient.PostAsJsonAsync("/waitlist", new { availabilitySlotId = slot.Id });

        var list = await mineClient.GetFromJsonAsync<List<WaitlistEntryDetailResponse>>("/waitlist");

        var entry = Assert.Single(list!);
        Assert.Equal(slot.Id, entry.AvailabilitySlotId);
        Assert.Equal(2, entry.Position);
        Assert.False(string.IsNullOrWhiteSpace(entry.ResourceName));
    }

    [Fact]
    public async Task DeleteWaitlist_Owner_RemovesEntry()
    {
        using var scope = fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();
        var slot = await TestData.CreateSlotAsync(db, capacityRemaining: 0);

        var client = fixture.CreateAuthenticatedClient("leaver");
        var created = await client.PostAsJsonAsync("/waitlist", new { availabilitySlotId = slot.Id });
        var entry = await created.Content.ReadFromJsonAsync<WaitlistEntryResponse>();

        var deleteResponse = await client.DeleteAsync($"/waitlist/{entry!.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var list = await client.GetFromJsonAsync<List<WaitlistEntryDetailResponse>>("/waitlist");
        Assert.Empty(list!);
    }

    [Fact]
    public async Task DeleteWaitlist_NotOwner_Is404()
    {
        using var scope = fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();
        var slot = await TestData.CreateSlotAsync(db, capacityRemaining: 0);

        var created = await fixture.CreateAuthenticatedClient("owner")
            .PostAsJsonAsync("/waitlist", new { availabilitySlotId = slot.Id });
        var entry = await created.Content.ReadFromJsonAsync<WaitlistEntryResponse>();

        var response = await fixture.CreateAuthenticatedClient("someone-else")
            .DeleteAsync($"/waitlist/{entry!.Id}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DeleteWaitlist_WithoutToken_Is401()
    {
        var response = await fixture.Factory.CreateClient()
            .DeleteAsync($"/waitlist/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
