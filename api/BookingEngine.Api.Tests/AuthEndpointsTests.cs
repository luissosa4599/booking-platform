using System.Net;
using System.Net.Http.Json;
using BookingEngine.Api.Application.Auth;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;

namespace BookingEngine.Api.Tests;

[Collection("Api")]
public class AuthEndpointsTests(ApiTestFixture fixture)
{
    private static readonly GoogleIdentity SampleIdentity =
        new("google-sub-123", "someone@gmail.com", "Some One", "https://pic");

    private HttpClient ClientWithGoogleStub() =>
        fixture.Factory
            .WithWebHostBuilder(b => b.ConfigureTestServices(s =>
                s.AddScoped<IGoogleIdTokenValidator>(_ => new StubGoogleValidator(SampleIdentity))))
            .CreateClient();

    [Fact]
    public async Task PostAuthGoogle_ValidIdToken_ReturnsSession()
    {
        var response = await ClientWithGoogleStub()
            .PostAsJsonAsync("/auth/google", new { idToken = "good-token" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var session = await response.Content.ReadFromJsonAsync<SessionResponse>();
        Assert.NotNull(session);
        Assert.False(string.IsNullOrWhiteSpace(session!.AccessToken));
        Assert.False(string.IsNullOrWhiteSpace(session.RefreshToken));
        Assert.Equal("someone@gmail.com", session.User.Email);
    }

    [Fact]
    public async Task PostAuthGoogle_RejectedIdToken_Returns401()
    {
        var response = await ClientWithGoogleStub()
            .PostAsJsonAsync("/auth/google", new { idToken = "bad-token" });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task PostAuthRefresh_RotatesRefreshToken_AndRejectsTheOldOne()
    {
        var client = ClientWithGoogleStub();

        var signIn = await client.PostAsJsonAsync("/auth/google", new { idToken = "good-token" });
        var first = (await signIn.Content.ReadFromJsonAsync<SessionResponse>())!;

        var refreshed = await client.PostAsJsonAsync("/auth/refresh", new { refreshToken = first.RefreshToken });
        Assert.Equal(HttpStatusCode.OK, refreshed.StatusCode);
        var second = (await refreshed.Content.ReadFromJsonAsync<SessionResponse>())!;
        Assert.NotEqual(first.RefreshToken, second.RefreshToken);

        // Re-using the rotated token is rejected.
        var replay = await client.PostAsJsonAsync("/auth/refresh", new { refreshToken = first.RefreshToken });
        Assert.Equal(HttpStatusCode.Unauthorized, replay.StatusCode);

        // ...and the replay attempt revoked the whole chain, so the new one is dead too.
        var afterReplay = await client.PostAsJsonAsync("/auth/refresh", new { refreshToken = second.RefreshToken });
        Assert.Equal(HttpStatusCode.Unauthorized, afterReplay.StatusCode);
    }

    [Fact]
    public async Task GetBookings_WithFreshAccessToken_Succeeds()
    {
        var client = ClientWithGoogleStub();
        var signIn = await client.PostAsJsonAsync("/auth/google", new { idToken = "good-token" });
        var session = (await signIn.Content.ReadFromJsonAsync<SessionResponse>())!;

        using var request = new HttpRequestMessage(HttpMethod.Get, "/bookings?scope=upcoming");
        request.Headers.Authorization = new("Bearer", session.AccessToken);
        var response = await fixture.Factory.CreateClient().SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private sealed class StubGoogleValidator(GoogleIdentity identity) : IGoogleIdTokenValidator
    {
        public Task<GoogleIdentity?> ValidateAsync(string idToken, CancellationToken ct = default) =>
            Task.FromResult(idToken == "good-token" ? identity : null);
    }
}
