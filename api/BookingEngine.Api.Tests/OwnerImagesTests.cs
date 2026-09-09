using System.Net;
using System.Net.Http.Json;
using BookingEngine.Api.Application.Owner;
using BookingEngine.Api.Infrastructure.Storage;
using BookingEngine.Domain;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace BookingEngine.Api.Tests;

[Collection("Api")]
public class OwnerImagesTests(ApiTestFixture fixture)
{
    // A stand-in that "enables" storage and hands back predictable URLs under
    // the resource's public prefix, so the DB-side endpoints can be exercised
    // without a real GCS bucket.
    private sealed class FakeImageStorage : IImageStorage
    {
        public bool Enabled => true;

        public Task<(string UploadUrl, string PublicUrl)> CreateUploadUrlAsync(
            Guid resourceId, string contentType, CancellationToken ct = default) =>
            Task.FromResult(
                ($"https://upload.example/{resourceId}/{Guid.NewGuid():N}",
                 $"https://storage.googleapis.com/test-bucket/spaces/{resourceId}/{Guid.NewGuid():N}.jpg"));

        public bool OwnsUrl(Guid resourceId, string url) =>
            url.StartsWith($"https://storage.googleapis.com/test-bucket/spaces/{resourceId}/", StringComparison.Ordinal);
    }

    private HttpClient HostClientWithStorage(string userId, IImageStorage storage)
    {
        var factory = fixture.Factory.WithWebHostBuilder(b =>
            b.ConfigureServices(s =>
            {
                s.RemoveAll<IImageStorage>();
                s.AddSingleton(storage);
            }));
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue(
                "Bearer", TestAuth.TokenFor(userId, "img@tempo.demo", AccountRole.Host));
        return client;
    }

    private async Task<Guid> OwnedResourceAsync(string ownerUserId)
    {
        using var scope = fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BookingEngine.Infrastructure.BookingEngineDbContext>();
        var type = await TestData.CreateResourceTypeAsync(db);
        var resource = await TestData.CreateOwnedResourceAsync(db, ownerUserId, type);
        return resource.Id;
    }

    [Fact]
    public async Task AllImageEndpoints_ForANonOwnedSpace_Are404()
    {
        var resourceId = await OwnedResourceAsync("img-owner-a");
        var stranger = HostClientWithStorage("img-stranger", new FakeImageStorage());

        Assert.Equal(HttpStatusCode.NotFound,
            (await stranger.PostAsJsonAsync($"/owner/spaces/{resourceId}/images/upload-url", new { contentType = "image/jpeg" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await stranger.PostAsJsonAsync($"/owner/spaces/{resourceId}/images", new { url = "x" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await stranger.DeleteAsync($"/owner/spaces/{resourceId}/images/{Guid.NewGuid()}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await stranger.PutAsJsonAsync($"/owner/spaces/{resourceId}/images/order", new { imageIds = new[] { Guid.NewGuid() } })).StatusCode);
    }

    [Fact]
    public async Task UploadUrl_WhenStorageDisabled_Is503()
    {
        var resourceId = await OwnedResourceAsync("img-owner-b");
        // The default registered GcsImageStorage is disabled (no GCS_* config).
        var host = fixture.CreateAuthenticatedClient("img-owner-b", "b@tempo.demo", AccountRole.Host);

        var response = await host.PostAsJsonAsync(
            $"/owner/spaces/{resourceId}/images/upload-url", new { contentType = "image/jpeg" });

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
    }

    [Fact]
    public async Task AddImage_WithAForeignUrl_Is400()
    {
        var resourceId = await OwnedResourceAsync("img-owner-c");
        var host = HostClientWithStorage("img-owner-c", new FakeImageStorage());

        var response = await host.PostAsJsonAsync(
            $"/owner/spaces/{resourceId}/images", new { url = "https://evil.example/whatever.jpg" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Add_Reorder_Delete_HappyPath()
    {
        var resourceId = await OwnedResourceAsync("img-owner-d");
        var storage = new FakeImageStorage();
        var host = HostClientWithStorage("img-owner-d", storage);

        // Two "uploads"
        var url1 = (await (await host.PostAsJsonAsync($"/owner/spaces/{resourceId}/images/upload-url", new { contentType = "image/jpeg" }))
            .Content.ReadFromJsonAsync<UploadUrlResponse>())!.PublicUrl;
        var url2 = (await (await host.PostAsJsonAsync($"/owner/spaces/{resourceId}/images/upload-url", new { contentType = "image/png" }))
            .Content.ReadFromJsonAsync<UploadUrlResponse>())!.PublicUrl;

        await host.PostAsJsonAsync($"/owner/spaces/{resourceId}/images", new { url = url1 });
        var listAfterAdd = await (await host.PostAsJsonAsync($"/owner/spaces/{resourceId}/images", new { url = url2 }))
            .Content.ReadFromJsonAsync<List<ResourceImageResponse>>();

        Assert.Equal(2, listAfterAdd!.Count);
        Assert.Equal(url1, listAfterAdd[0].Url);
        Assert.Equal(new[] { 0, 1 }, listAfterAdd.Select(i => i.Position).ToArray());

        // Reverse the order
        var reordered = await (await host.PutAsJsonAsync(
                $"/owner/spaces/{resourceId}/images/order",
                new { imageIds = new[] { listAfterAdd[1].Id, listAfterAdd[0].Id } }))
            .Content.ReadFromJsonAsync<List<ResourceImageResponse>>();
        Assert.Equal(url2, reordered![0].Url);

        // Delete the first -> one left, re-packed to position 0
        var afterDelete = await (await host.DeleteAsync($"/owner/spaces/{resourceId}/images/{reordered[0].Id}"))
            .Content.ReadFromJsonAsync<List<ResourceImageResponse>>();
        var only = Assert.Single(afterDelete!);
        Assert.Equal(url1, only.Url);
        Assert.Equal(0, only.Position);

        // And it shows up on the guest resource detail
        var detail = await fixture.Factory.CreateClient()
            .GetFromJsonAsync<ResourceDetailWithPhotos>($"/resources/{resourceId}");
        Assert.Equal(new[] { url1 }, detail!.Photos.ToArray());
    }

    private record ResourceDetailWithPhotos(IReadOnlyList<string> Photos);
}
