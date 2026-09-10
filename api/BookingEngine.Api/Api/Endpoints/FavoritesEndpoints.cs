using System.Security.Claims;
using BookingEngine.Api.Application.Auth;
using BookingEngine.Api.Application.Favorites;
using BookingEngine.Api.Application.Validation;
using BookingEngine.Domain;
using BookingEngine.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace BookingEngine.Api.Api.Endpoints;

public static class FavoritesEndpoints
{
    public static void MapFavoritesEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/favorites", async (
            ClaimsPrincipal principal,
            BookingEngineDbContext db,
            CancellationToken ct) =>
        {
            var userId = principal.UserId();

            var favorites = await db.Favorites
                .AsNoTracking()
                .Where(f => f.UserId == userId)
                .OrderByDescending(f => f.CreatedAt)
                .Select(f => new FavoriteResourceResponse(
                    f.ResourceId,
                    f.Resource.Name,
                    f.Resource.Location.Name,
                    f.Resource.Location.Address,
                    f.Resource.ResourceTypeId))
                .ToListAsync(ct);

            return Results.Ok(favorites);
        })
        .RequireAuthorization()
        .WithName("GetMyFavorites");

        // Idempotent upsert, same shape as POST /devices: a repeat favorite of
        // the same resource is a 204 no-op, not an error.
        app.MapPost("/favorites", async (
            CreateFavoriteRequest request,
            ClaimsPrincipal principal,
            BookingEngineDbContext db,
            CancellationToken ct) =>
        {
            var userId = principal.UserId();

            var existing = await db.Favorites.FirstOrDefaultAsync(
                f => f.UserId == userId && f.ResourceId == request.ResourceId, ct);

            if (existing is null)
            {
                var resourceExists = await db.Resources.AnyAsync(r => r.Id == request.ResourceId, ct);
                if (!resourceExists)
                {
                    return Results.BadRequest(new { message = "Unknown resource." });
                }

                db.Favorites.Add(new FavoriteResource
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    ResourceId = request.ResourceId,
                    CreatedAt = DateTimeOffset.UtcNow,
                });
                await db.SaveChangesAsync(ct);
            }

            return Results.NoContent();
        })
        .RequireAuthorization()
        .AddEndpointFilter<ValidationFilter<CreateFavoriteRequest>>()
        .WithName("AddFavorite");

        app.MapDelete("/favorites/{resourceId:guid}", async (
            Guid resourceId,
            ClaimsPrincipal principal,
            BookingEngineDbContext db,
            CancellationToken ct) =>
        {
            var userId = principal.UserId();

            await db.Favorites
                .Where(f => f.UserId == userId && f.ResourceId == resourceId)
                .ExecuteDeleteAsync(ct);

            return Results.NoContent();
        })
        .RequireAuthorization()
        .WithName("RemoveFavorite");
    }
}
