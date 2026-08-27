using BookingEngine.Api.Application.Auth;

namespace BookingEngine.Api.Tests;

public class MagicLinkTokensTests
{
    private const string Secret = "test-secret";

    [Theory]
    [InlineData("luis@uni.mx", true)]
    [InlineData("a@b.co", true)]
    [InlineData("nope", false)]
    [InlineData("no@domain", false)]
    [InlineData("", false)]
    public void IsValidEmail(string email, bool expected)
    {
        Assert.Equal(expected, MagicLinkTokens.IsValidEmail(email));
    }

    [Fact]
    public void RoundTrips_ValidToken()
    {
        var now = DateTimeOffset.UtcNow;
        var token = MagicLinkTokens.Issue("Luis@Uni.MX", Secret, now);

        Assert.True(MagicLinkTokens.TryValidate(token, Secret, now, out var email));
        Assert.Equal("luis@uni.mx", email);
    }

    [Fact]
    public void Rejects_TamperedToken()
    {
        var now = DateTimeOffset.UtcNow;
        var token = MagicLinkTokens.Issue("luis@uni.mx", Secret, now);
        var tampered = token[..^2] + (token[^1] == 'a' ? "bb" : "aa");

        Assert.False(MagicLinkTokens.TryValidate(tampered, Secret, now, out _));
    }

    [Fact]
    public void Rejects_WrongSecret()
    {
        var now = DateTimeOffset.UtcNow;
        var token = MagicLinkTokens.Issue("luis@uni.mx", Secret, now);

        Assert.False(MagicLinkTokens.TryValidate(token, "other-secret", now, out _));
    }

    [Fact]
    public void Rejects_ExpiredToken()
    {
        var issued = DateTimeOffset.UtcNow.AddHours(-1);
        var token = MagicLinkTokens.Issue("luis@uni.mx", Secret, issued);

        Assert.False(MagicLinkTokens.TryValidate(token, Secret, DateTimeOffset.UtcNow, out _));
    }

    [Fact]
    public void UserIdFor_IsStableAndCaseInsensitive()
    {
        Assert.Equal(
            MagicLinkTokens.UserIdFor("luis@uni.mx"),
            MagicLinkTokens.UserIdFor("  Luis@Uni.MX  "));
        Assert.NotEqual(
            MagicLinkTokens.UserIdFor("luis@uni.mx"),
            MagicLinkTokens.UserIdFor("otro@uni.mx"));
    }
}
