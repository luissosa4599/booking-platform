using System.Net.Http.Headers;
using BookingEngine.Api.Application.Auth;
using BookingEngine.Api.Domain;

namespace BookingEngine.Api.Tests;

/// <summary>
/// The test host runs with no AUTH_TOKEN_SECRET override, so it validates
/// access tokens against <see cref="AuthOptions"/>' dev defaults. That lets a
/// test mint a valid bearer token for any user id without going through Google.
/// </summary>
public static class TestAuth
{
    private static readonly SessionTokens Tokens = new(new AuthOptions());

    public static HttpClient CreateAuthenticatedClient(
        this ApiTestFixture fixture,
        string userId,
        string email = "test@tempo.demo")
    {
        var client = fixture.Factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TokenFor(userId, email));
        return client;
    }

    public static string TokenFor(string userId, string email = "test@tempo.demo") =>
        Tokens.IssueAccessToken(
            new User { Id = userId, Email = email },
            DateTimeOffset.UtcNow);
}
