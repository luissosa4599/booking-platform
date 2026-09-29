using System.Net;
using System.Net.Http.Headers;
using BookingEngine.Api.Application.Images;
using BookingEngine.Infrastructure;
using Microsoft.Extensions.DependencyInjection;

namespace BookingEngine.Api.Tests;

public class ImageVariantsTests
{
    private const string Seeded = "https://images.unsplash.com/photo-123?auto=format&fit=crop&w=1200&q=70";

    [Fact]
    public void Card_ShrinksUnsplashWidthAndQuality_KeepsOtherParams()
    {
        var url = new Uri(ImageVariants.Card(Seeded)!);

        Assert.Equal("images.unsplash.com", url.Host);
        Assert.Equal("/photo-123", url.AbsolutePath);
        Assert.Contains("w=720", url.Query);
        Assert.Contains("q=60", url.Query);
        Assert.Contains("fit=crop", url.Query);
        Assert.Contains("auto=format", url.Query);
        Assert.DoesNotContain("w=1200", url.Query);
    }

    [Fact]
    public void Thumb_IsSmallerThanCard()
    {
        Assert.Contains("w=240", ImageVariants.Thumb(Seeded));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("https://storage.googleapis.com/tempo-space-photos/abc.jpg")]
    [InlineData("not a url")]
    public void NonUnsplash_IsReturnedUnchanged(string? input)
    {
        Assert.Equal(input, ImageVariants.Card(input));
    }
}

[Collection("Api")]
public class ResponseCompressionTests(ApiTestFixture fixture)
{
    [Fact]
    public async Task Availability_IsCompressed_WhenClientAcceptsGzip()
    {
        using (var scope = fixture.Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();
            await TestData.CreateSlotAsync(db, capacityRemaining: 3);
        }

        var client = fixture.Factory.CreateClient();
        var from = Uri.EscapeDataString(DateTimeOffset.UtcNow.AddDays(-1).ToString("O"));
        var to = Uri.EscapeDataString(DateTimeOffset.UtcNow.AddDays(30).ToString("O"));
        var request = new HttpRequestMessage(HttpMethod.Get, $"/availability?from={from}&to={to}");
        request.Headers.AcceptEncoding.Add(new StringWithQualityHeaderValue("gzip"));

        var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("gzip", response.Content.Headers.ContentEncoding);
    }
}
