using System.Net;
using System.Net.Http.Json;
using BookingEngine.Api.Application.Waitlist;
using BookingEngine.Api.Infrastructure;
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

        var client = fixture.Factory.CreateClient();

        var first = await client.PostAsJsonAsync("/waitlist", new { availabilitySlotId = slot.Id, userId = "user-a" });
        var second = await client.PostAsJsonAsync("/waitlist", new { availabilitySlotId = slot.Id, userId = "user-b" });

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

        var client = fixture.Factory.CreateClient();
        var body = new { availabilitySlotId = slot.Id, userId = "repeat-user" };

        var first = await client.PostAsJsonAsync("/waitlist", body);
        var second = await client.PostAsJsonAsync("/waitlist", body);

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);

        var list = await client.GetFromJsonAsync<List<WaitlistEntryDetailResponse>>("/waitlist?userId=repeat-user");
        Assert.Single(list!, e => e.AvailabilitySlotId == slot.Id);
    }

    [Fact]
    public async Task PostWaitlist_SlotWithCapacity_IsRejected()
    {
        using var scope = fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();
        var slot = await TestData.CreateSlotAsync(db, capacityRemaining: 3);

        var client = fixture.Factory.CreateClient();
        var response = await client.PostAsJsonAsync("/waitlist", new { availabilitySlotId = slot.Id, userId = "user-a" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetWaitlist_ReturnsEntriesWithPositionAndResource()
    {
        using var scope = fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();
        var slot = await TestData.CreateSlotAsync(db, capacityRemaining: 0);

        var client = fixture.Factory.CreateClient();
        await client.PostAsJsonAsync("/waitlist", new { availabilitySlotId = slot.Id, userId = "ahead" });
        await client.PostAsJsonAsync("/waitlist", new { availabilitySlotId = slot.Id, userId = "mine" });

        var list = await client.GetFromJsonAsync<List<WaitlistEntryDetailResponse>>("/waitlist?userId=mine");

        var entry = Assert.Single(list!);
        Assert.Equal(slot.Id, entry.AvailabilitySlotId);
        Assert.Equal(2, entry.Position);
        Assert.False(string.IsNullOrWhiteSpace(entry.ResourceName));
    }
}
