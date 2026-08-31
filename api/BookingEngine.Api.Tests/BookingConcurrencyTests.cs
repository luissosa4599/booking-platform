using System.Net;
using System.Net.Http.Json;
using BookingEngine.Api.Infrastructure;
using Microsoft.Extensions.DependencyInjection;

namespace BookingEngine.Api.Tests;

[Collection("Api")]
public class BookingConcurrencyTests(ApiTestFixture fixture)
{
    [Fact]
    public async Task PostBookings_TwoConcurrentRequestsForLastSeat_OneSucceedsOneConflicts()
    {
        using var setupScope = fixture.Factory.Services.CreateScope();
        var setupDb = setupScope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();
        // Exactly one seat left — both requests read CapacityRemaining=1 and
        // pass the initial check; only one can win the SaveChanges race.
        var slot = await TestData.CreateSlotAsync(setupDb, capacityRemaining: 1);

        Task<HttpResponseMessage> PostBooking(string userId)
        {
            var body = new { availabilitySlotId = slot.Id, seats = 1 };
            var request = new HttpRequestMessage(HttpMethod.Post, "/bookings")
            {
                Content = JsonContent.Create(body),
            };
            request.Headers.Add("Idempotency-Key", Guid.NewGuid().ToString());
            return fixture.CreateAuthenticatedClient(userId).SendAsync(request);
        }

        var responses = await Task.WhenAll(PostBooking("user-a"), PostBooking("user-b"));

        var statusCodes = responses.Select(r => r.StatusCode).OrderBy(s => s).ToList();

        Assert.Equal(
            [HttpStatusCode.Created, HttpStatusCode.Conflict],
            statusCodes);
    }
}
