using System.Net;
using System.Net.Http.Json;
using BookingEngine.Domain;
using BookingEngine.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.JsonWebTokens;

namespace BookingEngine.Api.Tests;

[Collection("Api")]
public class MeEndpointsTests(ApiTestFixture fixture)
{
    private async Task<User> SeedUserAsync(AccountRole role = AccountRole.Guest)
    {
        using var scope = fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();
        var now = DateTimeOffset.UtcNow;
        var user = new User
        {
            Id = $"user-{Guid.NewGuid():N}",
            Email = $"{Guid.NewGuid():N}@tempo.demo",
            DisplayName = "Test Person",
            Role = role,
            CreatedAt = now,
            LastSeenAt = now,
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return user;
    }

    [Fact]
    public async Task GetMe_ReturnsIdentityAndCounters_Guest()
    {
        var user = await SeedUserAsync();
        var client = fixture.CreateAuthenticatedClient(user.Id, user.Email);

        var body = await client.GetFromJsonAsync<MeBody>("/me");

        Assert.NotNull(body);
        Assert.Equal(user.Id, body!.Id);
        Assert.Equal("guest", body.Role);
        Assert.Equal(0, body.BookingCount);
        Assert.Equal(0, body.StreakWeeks);
    }

    [Fact]
    public async Task BecomeHost_FlipsRole_AndReturnsSessionWithHostToken()
    {
        var user = await SeedUserAsync();
        var client = fixture.CreateAuthenticatedClient(user.Id, user.Email);

        var response = await client.PostAsync("/me/become-host", content: null);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var session = await response.Content.ReadFromJsonAsync<SessionBody>();
        Assert.NotNull(session);
        Assert.Equal("host", session!.User.Role);

        var handler = new JsonWebTokenHandler { MapInboundClaims = false };
        var jwt = handler.ReadJsonWebToken(session.AccessToken);
        Assert.Equal("host", jwt.GetClaim("role").Value);

        using var scope = fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();
        var stored = await db.Users.AsNoTracking().FirstAsync(u => u.Id == user.Id);
        Assert.Equal(AccountRole.Host, stored.Role);
    }

    [Fact]
    public async Task BecomeHost_IsIdempotent()
    {
        var user = await SeedUserAsync(AccountRole.Host);
        var client = fixture.CreateAuthenticatedClient(user.Id, user.Email, AccountRole.Host);

        var first = await client.PostAsync("/me/become-host", content: null);
        var second = await client.PostAsync("/me/become-host", content: null);

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
    }

    // The "Host" auth policy itself is exercised in OwnerSpacesTests (PR B1),
    // where the first Host-only endpoint lands.

    private record MeBody(
        string Id,
        string Email,
        string? DisplayName,
        string? AvatarUrl,
        string Role,
        int BookingCount,
        int StreakWeeks,
        DateTimeOffset CreatedAt);

    private record SessionBody(string AccessToken, string RefreshToken, DateTimeOffset AccessTokenExpiresAt, AuthUserBody User);

    private record AuthUserBody(string Id, string Email, string? DisplayName, string? AvatarUrl, string Role);
}
