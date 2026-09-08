using System.Net;
using System.Net.Http.Json;

namespace BookingEngine.Api.Tests;

[Collection("Api")]
public class GeocodeEndpointsTests(ApiTestFixture fixture)
{
    [Fact]
    public async Task ReverseGeocode_WithoutToken_Is401()
    {
        var response = await fixture.Factory.CreateClient()
            .GetAsync("/geocode/reverse?lat=19.4&lng=-99.1");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task ReverseGeocode_OutOfRange_Is400()
    {
        var client = fixture.CreateAuthenticatedClient("geo-user");
        var response = await client.GetAsync("/geocode/reverse?lat=999&lng=-99.1");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task ReverseGeocode_NoServerKeyConfigured_ReturnsNullAddress()
    {
        // The test host sets no GOOGLE_MAPS_SERVER_KEY, so the proxy is disabled
        // and must degrade to { "address": null } rather than error.
        var client = fixture.CreateAuthenticatedClient("geo-user");
        var response = await client.GetAsync("/geocode/reverse?lat=19.4326&lng=-99.1332");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ReverseResult>();
        Assert.Null(body!.Address);
    }

    private record ReverseResult(string? Address);
}
