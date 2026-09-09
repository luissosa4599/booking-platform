using System.Net;
using System.Net.Http.Json;
using BookingEngine.Api.Application.Favorites;
using BookingEngine.Infrastructure;
using Microsoft.Extensions.DependencyInjection;

namespace BookingEngine.Api.Tests;

[Collection("Api")]
public class FavoritesEndpointsTests(ApiTestFixture fixture)
{
    [Fact]
    public async Task GetFavorites_WithoutToken_Is401()
    {
        var response = await fixture.Factory.CreateClient().GetAsync("/favorites");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task PostThenGet_ReturnsTheFavoritedResource()
    {
        using var scope = fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();
        var slot = await TestData.CreateSlotAsync(db, capacityRemaining: 3);

        var client = fixture.CreateAuthenticatedClient("fav-user-a");
        var post = await client.PostAsJsonAsync("/favorites", new { resourceId = slot.ResourceId });
        Assert.Equal(HttpStatusCode.NoContent, post.StatusCode);

        var list = await client.GetFromJsonAsync<List<FavoriteResourceResponse>>("/favorites");
        var entry = Assert.Single(list!);
        Assert.Equal(slot.ResourceId, entry.ResourceId);
        Assert.False(string.IsNullOrWhiteSpace(entry.Name));
        Assert.False(string.IsNullOrWhiteSpace(entry.LocationName));
    }

    [Fact]
    public async Task PostFavorite_Twice_IsIdempotent()
    {
        using var scope = fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();
        var slot = await TestData.CreateSlotAsync(db, capacityRemaining: 3);

        var client = fixture.CreateAuthenticatedClient("fav-user-b");
        var body = new { resourceId = slot.ResourceId };

        var first = await client.PostAsJsonAsync("/favorites", body);
        var second = await client.PostAsJsonAsync("/favorites", body);

        Assert.Equal(HttpStatusCode.NoContent, first.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, second.StatusCode);

        var list = await client.GetFromJsonAsync<List<FavoriteResourceResponse>>("/favorites");
        Assert.Single(list!, e => e.ResourceId == slot.ResourceId);
    }

    [Fact]
    public async Task DeleteFavorite_ThatIsNotThere_Is204()
    {
        var client = fixture.CreateAuthenticatedClient("fav-user-c");
        var response = await client.DeleteAsync($"/favorites/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task PostThenDelete_RemovesIt_AndIsScopedToCaller()
    {
        using var scope = fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();
        var slot = await TestData.CreateSlotAsync(db, capacityRemaining: 3);

        var mine = fixture.CreateAuthenticatedClient("fav-owner");
        var other = fixture.CreateAuthenticatedClient("fav-other");

        await mine.PostAsJsonAsync("/favorites", new { resourceId = slot.ResourceId });
        await other.PostAsJsonAsync("/favorites", new { resourceId = slot.ResourceId });

        var del = await mine.DeleteAsync($"/favorites/{slot.ResourceId}");
        Assert.Equal(HttpStatusCode.NoContent, del.StatusCode);

        Assert.Empty((await mine.GetFromJsonAsync<List<FavoriteResourceResponse>>("/favorites"))!);
        Assert.Single((await other.GetFromJsonAsync<List<FavoriteResourceResponse>>("/favorites"))!);
    }

    [Fact]
    public async Task PostFavorite_UnknownResource_Is400()
    {
        var client = fixture.CreateAuthenticatedClient("fav-user-d");
        var response = await client.PostAsJsonAsync("/favorites", new { resourceId = Guid.NewGuid() });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
