using BookingEngine.Api.Application.Availability;
using BookingEngine.Api.Application.ResourceTypes;
using BookingEngine.Api.Application.Resources;
using BookingEngine.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace BookingEngine.Api.Api.Endpoints;

public static class ResourcesEndpoints
{
    public static void MapResourcesEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/resources/{id:guid}", async (Guid id, BookingEngineDbContext db) =>
        {
            var resource = await db.Resources
                .AsNoTracking()
                .Where(r => r.Id == id)
                .Select(r => new ResourceDetailResponse(
                    r.Id,
                    r.ResourceTypeId,
                    r.ResourceType.Name,
                    new ResourceLabelsResponse(
                        r.ResourceType.Labels.Singular,
                        r.ResourceType.Labels.Plural,
                        r.ResourceType.Labels.CapacityUnit,
                        r.ResourceType.Labels.ActionVerb),
                    r.LocationId,
                    r.Location.Name,
                    r.Name,
                    r.Capacity,
                    r.Description,
                    r.AvailabilitySlots
                        .Where(s => s.EndsAt > DateTimeOffset.UtcNow)
                        .OrderBy(s => s.StartsAt)
                        .Select(s => new AvailabilitySlotResponse(
                            s.Id,
                            s.ResourceId,
                            r.Name,
                            r.ResourceTypeId,
                            r.Location.Name,
                            s.StartsAt,
                            s.EndsAt,
                            s.CapacityRemaining,
                            s.RowVersion))
                        .ToList()))
                .FirstOrDefaultAsync();

            return resource is null ? Results.NotFound() : Results.Ok(resource);
        })
        .WithName("GetResourceDetail");
    }
}
