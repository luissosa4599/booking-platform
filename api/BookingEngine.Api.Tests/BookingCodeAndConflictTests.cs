using System.Net;
using System.Net.Http.Json;
using BookingEngine.Api.Application.Bookings;
using BookingEngine.Api.Infrastructure;
using Microsoft.Extensions.DependencyInjection;

namespace BookingEngine.Api.Tests;

[Collection("Api")]
public class BookingCodeAndConflictTests(ApiTestFixture fixture)
{
    [Fact]
    public async Task PostBookings_Success_ReturnsHumanReadableCode()
    {
        using var scope = fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();
        var slot = await TestData.CreateSlotAsync(db, capacityRemaining: 3);

        var client = fixture.Factory.CreateClient();
        var request = new HttpRequestMessage(HttpMethod.Post, "/bookings")
        {
            Content = JsonContent.Create(new { availabilitySlotId = slot.Id, userId = "user-1", seats = 1 }),
        };
        request.Headers.Add("Idempotency-Key", Guid.NewGuid().ToString());

        var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<BookingResponse>();
        Assert.NotNull(body);
        Assert.Matches("^[A-Z]{3}-[0-9]{4}$", body!.Code);
    }

    [Fact]
    public async Task PostBookings_FullSlot_Returns409WithPrecalculatedAlternatives()
    {
        using var scope = fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();

        var now = DateTimeOffset.UtcNow;
        var fullSlot = await TestData.CreateSlotAsync(db, capacityRemaining: 0, startsAt: now.AddHours(2));
        // Same resource, one hour later, with room — this is the alternative the API should surface.
        var altSlot = await TestData.AddSlotToResourceAsync(
            db, fullSlot.ResourceId, capacityRemaining: 4, startsAt: now.AddHours(3));

        var client = fixture.Factory.CreateClient();
        var request = new HttpRequestMessage(HttpMethod.Post, "/bookings")
        {
            Content = JsonContent.Create(new { availabilitySlotId = fullSlot.Id, userId = "user-1", seats = 1 }),
        };
        request.Headers.Add("Idempotency-Key", Guid.NewGuid().ToString());

        var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<BookingConflictResponse>();
        Assert.NotNull(body);
        Assert.Equal(fullSlot.Id, body!.AvailabilitySlotId);
        Assert.Contains(body.Alternatives, a => a.SlotId == altSlot.Id && a.DistanceNote == "Mismo espacio");
    }

    [Fact]
    public async Task PostBookings_StaleRowVersion_Returns409()
    {
        using var scope = fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();
        var slot = await TestData.CreateSlotAsync(db, capacityRemaining: 5);

        var client = fixture.Factory.CreateClient();
        var request = new HttpRequestMessage(HttpMethod.Post, "/bookings")
        {
            Content = JsonContent.Create(new
            {
                availabilitySlotId = slot.Id,
                userId = "user-1",
                seats = 1,
                rowVersion = 1u, // definitely not the slot's real xmin
            }),
        };
        request.Headers.Add("Idempotency-Key", Guid.NewGuid().ToString());

        var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task GetBookingStreak_NoBookings_ReturnsZero()
    {
        var client = fixture.Factory.CreateClient();
        var body = await client.GetFromJsonAsync<StreakResponse>(
            $"/bookings/streak?userId=nobody-{Guid.NewGuid():N}");

        Assert.NotNull(body);
        Assert.Equal(0, body!.Weeks);
    }

    private record StreakResponse(int Weeks);
}
