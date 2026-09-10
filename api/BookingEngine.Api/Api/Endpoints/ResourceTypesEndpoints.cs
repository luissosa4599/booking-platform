using BookingEngine.Api.Application.ResourceTypes;
using BookingEngine.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace BookingEngine.Api.Api.Endpoints;

public static class ResourceTypesEndpoints
{
    public static void MapResourceTypesEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/resource-types", async (BookingEngineDbContext db) =>
        {
            var resourceTypes = await db.ResourceTypes
                .AsNoTracking()
                .Select(t => new ResourceTypeResponse(
                    t.Id,
                    t.Name,
                    new ResourceLabelsResponse(
                        t.Labels.Singular,
                        t.Labels.Plural,
                        t.Labels.CapacityUnit,
                        t.Labels.ActionVerb),
                    t.AllowsMultipleSeats,
                    t.AllowsWaitlist))
                .ToListAsync();

            return Results.Ok(resourceTypes);
        })
        .WithName("GetResourceTypes");
    }
}
