using System.Net;
using System.Net.Http.Json;
using BookingEngine.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace BookingEngine.Api.Tests;

[Collection("Api")]
public class BookingIdempotencyTests(ApiTestFixture fixture)
{
    [Fact]
    public async Task PostBookings_WithSameIdempotencyKey_DoesNotCreateDuplicate()
    {
        using var setupScope = fixture.Factory.Services.CreateScope();
        var setupDb = setupScope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();
        var slot = await TestData.CreateSlotAsync(setupDb, capacityRemaining: 5);

        var client = fixture.CreateAuthenticatedClient("user-1");
        var idempotencyKey = Guid.NewGuid().ToString();
        var body = new { availabilitySlotId = slot.Id, seats = 1 };

        using var request1 = new HttpRequestMessage(HttpMethod.Post, "/bookings")
        {
            Content = JsonContent.Create(body),
        };
        request1.Headers.Add("Idempotency-Key", idempotencyKey);
        var response1 = await client.SendAsync(request1);

        using var request2 = new HttpRequestMessage(HttpMethod.Post, "/bookings")
        {
            Content = JsonContent.Create(body),
        };
        request2.Headers.Add("Idempotency-Key", idempotencyKey);
        var response2 = await client.SendAsync(request2);

        Assert.Equal(HttpStatusCode.Created, response1.StatusCode);
        Assert.Equal(HttpStatusCode.OK, response2.StatusCode);

        using var assertScope = fixture.Factory.Services.CreateScope();
        var assertDb = assertScope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();
        var count = await assertDb.Bookings.CountAsync(b => b.IdempotencyKey == idempotencyKey);

        Assert.Equal(1, count);
    }
}
