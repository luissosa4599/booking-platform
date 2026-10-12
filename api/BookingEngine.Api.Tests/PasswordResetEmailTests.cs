using BookingEngine.Api.Application.Auth;
using BookingEngine.Api.Infrastructure.Email;

namespace BookingEngine.Api.Tests;

public class PasswordResetEmailTests
{
    private const string Link = "https://tempo.example/reset-password?token=abc.def&x=1";

    [Fact]
    public void Render_FillsEveryPlaceholder_AndKeepsTheAccents()
    {
        var (html, text) = PasswordResetEmail.Render(Link, "https://tempo.example/");

        foreach (var body in new[] { html, text })
        {
            Assert.DoesNotContain("{{", body);
            Assert.DoesNotContain("Aparta tu lugar", body);
            Assert.Contains("Tempo", body);
            Assert.Contains("30 minutos", body);
            // Read as UTF-8 from the embedded resource, not mangled through a
            // CP1252 .cs literal.
            Assert.Contains("contrase\u00f1a", body);
            Assert.Contains("Versi\u00f3n de prueba", body);
        }
        Assert.Contains("href=\"https://tempo.example/reset-password?token=abc.def&amp;x=1\"", html);
        Assert.Contains("src=\"https://tempo.example/email/logo-email.png\"", html);
        Assert.Contains(Link, text);
    }

    [Fact]
    public void Throttle_OneMessagePerIntervalPerAddress()
    {
        var throttle = new ResetEmailThrottle();
        var t0 = DateTimeOffset.UtcNow;

        Assert.True(throttle.TryAcquire("a@x.mx", t0));
        Assert.False(throttle.TryAcquire("a@x.mx", t0.AddSeconds(10)));
        Assert.True(throttle.TryAcquire("b@x.mx", t0.AddSeconds(10)));
        Assert.True(throttle.TryAcquire("a@x.mx", t0 + ResetEmailThrottle.MinInterval));
    }

    [Fact]
    public void Throttle_DailyCapPerAddress_ResetsAfterADay()
    {
        var throttle = new ResetEmailThrottle();
        var t = DateTimeOffset.UtcNow;
        for (var i = 0; i < ResetEmailThrottle.PerAddressPerDay; i++)
        {
            Assert.True(throttle.TryAcquire("a@x.mx", t));
            t += TimeSpan.FromMinutes(5);
        }

        Assert.False(throttle.TryAcquire("a@x.mx", t));
        Assert.True(throttle.TryAcquire("a@x.mx", t + TimeSpan.FromDays(1)));
    }

    [Fact]
    public void Throttle_GlobalDailyCap()
    {
        var throttle = new ResetEmailThrottle();
        var t = DateTimeOffset.UtcNow;
        for (var i = 0; i < ResetEmailThrottle.TotalPerDay; i++)
        {
            Assert.True(throttle.TryAcquire($"u{i}@x.mx", t));
        }

        Assert.False(throttle.TryAcquire("one-more@x.mx", t.AddMinutes(1)));
        Assert.True(throttle.TryAcquire("one-more@x.mx", t + TimeSpan.FromDays(1)));
    }
}
