using BookingEngine.Api.Application.Auth;
using BookingEngine.Api.Domain;
using Microsoft.IdentityModel.JsonWebTokens;

namespace BookingEngine.Api.Tests;

public class SessionTokensTests
{
    private readonly SessionTokens _tokens = new(new AuthOptions());

    [Fact]
    public async Task AccessToken_RoundTrips_WithSubAndEmail()
    {
        var user = new User { Id = "user-42", Email = "luis@uni.mx", DisplayName = "Luis" };
        var jwt = _tokens.IssueAccessToken(user, DateTimeOffset.UtcNow);

        var result = await new JsonWebTokenHandler
        {
            MapInboundClaims = false,
        }.ValidateTokenAsync(jwt, _tokens.ValidationParameters());

        Assert.True(result.IsValid);
        Assert.Equal("user-42", result.ClaimsIdentity.FindFirst(JwtRegisteredClaimNames.Sub)!.Value);
        Assert.Equal("luis@uni.mx", result.ClaimsIdentity.FindFirst(JwtRegisteredClaimNames.Email)!.Value);
    }

    [Fact]
    public async Task AccessToken_WrongSecret_FailsValidation()
    {
        var jwt = _tokens.IssueAccessToken(new User { Id = "u", Email = "e@e.co" }, DateTimeOffset.UtcNow);

        var otherKey = new SessionTokens(new AuthOptions { Secret = "a-different-secret-entirely" });
        var result = await new JsonWebTokenHandler().ValidateTokenAsync(jwt, otherKey.ValidationParameters());

        Assert.False(result.IsValid);
    }

    [Fact]
    public async Task AccessToken_Expired_FailsValidation()
    {
        var jwt = _tokens.IssueAccessToken(
            new User { Id = "u", Email = "e@e.co" },
            DateTimeOffset.UtcNow.AddHours(-2));

        var result = await new JsonWebTokenHandler().ValidateTokenAsync(jwt, _tokens.ValidationParameters());

        Assert.False(result.IsValid);
    }

    [Fact]
    public void RefreshToken_HashIsDeterministic_AndRawIsNot()
    {
        var (raw1, hash1) = SessionTokens.NewRefreshToken();
        var (raw2, _) = SessionTokens.NewRefreshToken();

        Assert.NotEqual(raw1, raw2);
        Assert.Equal(hash1, SessionTokens.HashRefreshToken(raw1));
        Assert.NotEqual(hash1, SessionTokens.HashRefreshToken(raw2));
    }
}
