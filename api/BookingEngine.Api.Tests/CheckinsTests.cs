using System.Net;
using System.Net.Http.Json;
using BookingEngine.Domain;
using BookingEngine.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace BookingEngine.Api.Tests;

[Collection("Api")]
public class CheckinsTests(ApiTestFixture fixture)
{
    // Creates: a host, a resource the host owns, a slot starting now, and a
    // confirmed booking on it by `guestId`. Returns the booking code.
    private async Task<(string code, string hostId, Guid bookingId)> SeedBookingAsync(
        DateTimeOffset? slotStart = null, string guestId = "guest-checkin")
    {
        using var scope = fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();

        var hostId = $"host-{Guid.NewGuid():N}";
        var type = await TestData.CreateResourceTypeAsync(db);
        var resource = await TestData.CreateOwnedResourceAsync(db, hostId, type);

        var start = slotStart ?? DateTimeOffset.UtcNow;
        var slot = new AvailabilitySlot
        {
            Id = Guid.NewGuid(),
            ResourceId = resource.Id,
            StartsAt = start,
            EndsAt = start.AddMinutes(90),
            CapacityRemaining = 3,
            Origin = SlotOrigin.Adhoc,
        };
        db.AvailabilitySlots.Add(slot);

        db.Users.Add(new User
        {
            Id = guestId,
            Email = $"{guestId}@tempo.demo",
            DisplayName = "Visitante Test",
            CreatedAt = DateTimeOffset.UtcNow,
            LastSeenAt = DateTimeOffset.UtcNow,
        });

        var booking = new Booking
        {
            Id = Guid.NewGuid(),
            AvailabilitySlotId = slot.Id,
            UserId = guestId,
            Seats = 2,
            Status = BookingStatus.Confirmed,
            Code = $"CHK-{Random.Shared.Next(1000, 9999)}",
            IdempotencyKey = Guid.NewGuid().ToString(),
            CreatedAt = DateTimeOffset.UtcNow,
        };
        db.Bookings.Add(booking);
        await db.SaveChangesAsync();

        return (booking.Code, hostId, booking.Id);
    }

    private record Result(string Status, string? VisitorName, string? SpaceName, int? Seats, string? Direction, DateTimeOffset? ConfirmedAt);

    [Fact]
    public async Task Checkin_HappyPath_MarksBookingAndAttributesHost()
    {
        var (code, hostId, bookingId) = await SeedBookingAsync();
        var host = fixture.CreateAuthenticatedClient(hostId, role: AccountRole.Host);

        var response = await host.PostAsJsonAsync("/checkins", new { code });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<Result>();

        Assert.Equal("confirmed", body!.Status);
        Assert.Equal("Visitante Test", body.VisitorName);
        Assert.Equal(2, body.Seats);

        using var scope = fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();
        var stored = await db.Bookings.AsNoTracking().FirstAsync(b => b.Id == bookingId);
        Assert.NotNull(stored.CheckedInAt);
        Assert.Equal(hostId, stored.CheckedInByUserId);
    }

    [Fact]
    public async Task Checkin_Twice_ReturnsAlreadyConfirmed_WithSameTimestamp()
    {
        var (code, hostId, bookingId) = await SeedBookingAsync();
        var host = fixture.CreateAuthenticatedClient(hostId, role: AccountRole.Host);

        var first = await (await host.PostAsJsonAsync("/checkins", new { code })).Content.ReadFromJsonAsync<Result>();
        var second = await (await host.PostAsJsonAsync("/checkins", new { code })).Content.ReadFromJsonAsync<Result>();

        Assert.Equal("confirmed", first!.Status);
        Assert.Equal("already_confirmed", second!.Status);

        using var scope = fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();
        var stored = await db.Bookings.AsNoTracking().FirstAsync(b => b.Id == bookingId);
        Assert.Equal(first.ConfirmedAt!.Value, stored.CheckedInAt!.Value, TimeSpan.FromSeconds(1));
    }

    [Fact]
    public async Task Checkin_UnknownCode_Returns404()
    {
        var host = fixture.CreateAuthenticatedClient("host-x", role: AccountRole.Host);
        var response = await host.PostAsJsonAsync("/checkins", new { code = "ZZZ-0000" });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<Result>();
        Assert.Equal("unknown_code", body!.Status);
    }

    [Fact]
    public async Task Checkin_CancelledBooking_Returns404()
    {
        var (code, hostId, bookingId) = await SeedBookingAsync();
        using (var scope = fixture.Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();
            var b = await db.Bookings.FirstAsync(x => x.Id == bookingId);
            b.Status = BookingStatus.Cancelled;
            await db.SaveChangesAsync();
        }

        var host = fixture.CreateAuthenticatedClient(hostId, role: AccountRole.Host);
        var response = await host.PostAsJsonAsync("/checkins", new { code });
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Checkin_OtherHost_Returns403WrongSpace()
    {
        var (code, _, _) = await SeedBookingAsync();
        var stranger = fixture.CreateAuthenticatedClient($"host-{Guid.NewGuid():N}", role: AccountRole.Host);

        var response = await stranger.PostAsJsonAsync("/checkins", new { code });
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<Result>();
        Assert.Equal("wrong_space", body!.Status);
    }

    [Fact]
    public async Task Checkin_TooEarly_Returns409Future_ForceOverrides()
    {
        var (code, hostId, _) = await SeedBookingAsync(slotStart: DateTimeOffset.UtcNow.AddHours(4));
        var host = fixture.CreateAuthenticatedClient(hostId, role: AccountRole.Host);

        var early = await host.PostAsJsonAsync("/checkins", new { code });
        Assert.Equal(HttpStatusCode.Conflict, early.StatusCode);
        var earlyBody = await early.Content.ReadFromJsonAsync<Result>();
        Assert.Equal("out_of_window", earlyBody!.Status);
        Assert.Equal("future", earlyBody.Direction);

        var forced = await host.PostAsJsonAsync("/checkins", new { code, force = true });
        Assert.Equal(HttpStatusCode.OK, forced.StatusCode);
        Assert.Equal("confirmed", (await forced.Content.ReadFromJsonAsync<Result>())!.Status);
    }

    [Fact]
    public async Task Checkin_AfterSlotEnded_Returns409Past()
    {
        var (code, hostId, _) = await SeedBookingAsync(slotStart: DateTimeOffset.UtcNow.AddHours(-4));
        var host = fixture.CreateAuthenticatedClient(hostId, role: AccountRole.Host);

        var response = await host.PostAsJsonAsync("/checkins", new { code });
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("past", (await response.Content.ReadFromJsonAsync<Result>())!.Direction);
    }

    [Fact]
    public async Task Checkin_GuestToken_Returns403()
    {
        var (code, _, _) = await SeedBookingAsync();
        var guest = fixture.CreateAuthenticatedClient("plain-guest", role: AccountRole.Guest);

        var response = await guest.PostAsJsonAsync("/checkins", new { code });
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task GetBookings_IncludesCheckedInAt()
    {
        var (code, hostId, _) = await SeedBookingAsync(guestId: "guest-listcheck");
        var host = fixture.CreateAuthenticatedClient(hostId, role: AccountRole.Host);
        await host.PostAsJsonAsync("/checkins", new { code });

        var guest = fixture.CreateAuthenticatedClient("guest-listcheck");
        var json = await guest.GetStringAsync("/bookings?scope=upcoming");
        Assert.Contains("checkedInAt", json);
        Assert.DoesNotContain("\"checkedInAt\":null", json);
    }
}
