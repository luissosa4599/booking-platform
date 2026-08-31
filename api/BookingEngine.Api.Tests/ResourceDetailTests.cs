using System.Net.Http.Json;
using BookingEngine.Api.Application.Resources;
using BookingEngine.Api.Infrastructure;
using Microsoft.Extensions.DependencyInjection;

namespace BookingEngine.Api.Tests;

[Collection("Api")]
public class ResourceDetailTests(ApiTestFixture fixture)
{
    [Fact]
    public async Task GetResourceDetail_IncludesLocationAddressAndCoordinates()
    {
        using var scope = fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();
        var slot = await TestData.CreateSlotAsync(db, capacityRemaining: 3);
        var resourceId = slot.ResourceId;

        var db2 = scope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();
        var resource = await db2.Resources.FindAsync(resourceId);
        var location = await db2.Locations.FindAsync(resource!.LocationId);
        location!.Address = "123 Test St";
        location.Latitude = 19.4195;
        location.Longitude = -99.1810;
        await db2.SaveChangesAsync();

        var client = fixture.Factory.CreateClient();
        var body = await client.GetFromJsonAsync<ResourceDetailResponse>($"/resources/{resourceId}");

        Assert.NotNull(body);
        Assert.Equal("123 Test St", body!.LocationAddress);
        Assert.Equal(19.4195, body.LocationLatitude);
        Assert.Equal(-99.1810, body.LocationLongitude);
    }

    [Fact]
    public async Task GetResourceDetail_NoCoordinates_ReturnsNulls()
    {
        using var scope = fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();
        var slot = await TestData.CreateSlotAsync(db, capacityRemaining: 3);

        var client = fixture.Factory.CreateClient();
        var body = await client.GetFromJsonAsync<ResourceDetailResponse>($"/resources/{slot.ResourceId}");

        Assert.NotNull(body);
        Assert.Null(body!.LocationLatitude);
        Assert.Null(body.LocationLongitude);
    }
}
