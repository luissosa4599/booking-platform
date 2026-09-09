using System.Net;
using System.Net.Http.Json;
using BookingEngine.Api.Application.Auth;
using BookingEngine.Api.Application.Calendar;
using BookingEngine.Domain;
using BookingEngine.Infrastructure;
using Microsoft.Extensions.DependencyInjection;

namespace BookingEngine.Api.Tests;

[Collection("Api")]
public class CalendarEndpointsTests(ApiTestFixture fixture)
{
    [Fact]
    public async Task Status_WithoutToken_Is401()
    {
        var response = await fixture.Factory.CreateClient().GetAsync("/calendar/status");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Status_NotConnected_NotConfigured()
    {
        // The test host sets no GOOGLE_WEB_CLIENT_ID / GOOGLE_CLIENT_SECRET.
        var client = fixture.CreateAuthenticatedClient("cal-user-a");
        var body = await client.GetFromJsonAsync<CalendarStatusResponse>("/calendar/status");

        Assert.NotNull(body);
        Assert.False(body!.Connected);
        Assert.False(body.Available);
    }

    [Fact]
    public async Task Connect_WhenNotConfigured_Is503()
    {
        var client = fixture.CreateAuthenticatedClient("cal-user-b");
        var response = await client.PostAsJsonAsync("/calendar/connect", new
        {
            code = "x",
            codeVerifier = "y",
            redirectUri = "http://localhost:8081",
        });
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
    }

    [Fact]
    public async Task Events_ForABookingThatIsNotYours_ReturnsNotFound()
    {
        using var scope = fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();
        var slot = await TestData.CreateSlotAsync(db, capacityRemaining: 5);
        var booking = new Booking
        {
            Id = Guid.NewGuid(),
            AvailabilitySlotId = slot.Id,
            UserId = "someone-else",
            Seats = 1,
            Status = BookingStatus.Confirmed,
            Code = "CAL-1234",
            IdempotencyKey = Guid.NewGuid().ToString(),
            CreatedAt = DateTimeOffset.UtcNow,
        };
        db.Bookings.Add(booking);
        await db.SaveChangesAsync();

        var client = fixture.CreateAuthenticatedClient("cal-stranger");
        var body = await (await client.PostAsJsonAsync("/calendar/events", new { bookingId = booking.Id }))
            .Content.ReadFromJsonAsync<CalendarEventResponse>();

        Assert.Equal("not_found", body!.Status);
    }

    [Fact]
    public async Task Events_WhenNotConnected_ReturnsNotConnected()
    {
        using var scope = fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();
        var slot = await TestData.CreateSlotAsync(db, capacityRemaining: 5);
        var userId = "cal-owner";
        db.Users.Add(new User
        {
            Id = userId,
            Email = "cal-owner@tempo.demo",
            CreatedAt = DateTimeOffset.UtcNow,
            LastSeenAt = DateTimeOffset.UtcNow,
        });
        var booking = new Booking
        {
            Id = Guid.NewGuid(),
            AvailabilitySlotId = slot.Id,
            UserId = userId,
            Seats = 1,
            Status = BookingStatus.Confirmed,
            Code = "CAL-5678",
            IdempotencyKey = Guid.NewGuid().ToString(),
            CreatedAt = DateTimeOffset.UtcNow,
        };
        db.Bookings.Add(booking);
        await db.SaveChangesAsync();

        var client = fixture.CreateAuthenticatedClient(userId, "cal-owner@tempo.demo");
        var body = await (await client.PostAsJsonAsync("/calendar/events", new { bookingId = booking.Id }))
            .Content.ReadFromJsonAsync<CalendarEventResponse>();

        Assert.Equal("not_connected", body!.Status);
    }
}

public class CalendarTokenCipherTests
{
    private static readonly CalendarTokenCipher Cipher = new(new AuthOptions());

    [Fact]
    public void RoundTrips()
    {
        const string secret = "1//0abc-REFRESH-token_xyz";
        var packed = Cipher.Encrypt(secret);
        Assert.NotEqual(secret, packed);
        Assert.Equal(secret, Cipher.Decrypt(packed));
    }

    [Fact]
    public void TamperedCiphertext_DecryptsToNull()
    {
        var packed = Cipher.Encrypt("something");
        var bytes = Convert.FromBase64String(packed);
        bytes[^1] ^= 0xFF; // flip a ciphertext bit
        Assert.Null(Cipher.Decrypt(Convert.ToBase64String(bytes)));
    }

    [Fact]
    public void Garbage_DecryptsToNull()
    {
        Assert.Null(Cipher.Decrypt("not base64 !!!"));
        Assert.Null(Cipher.Decrypt(Convert.ToBase64String(new byte[4])));
    }
}
