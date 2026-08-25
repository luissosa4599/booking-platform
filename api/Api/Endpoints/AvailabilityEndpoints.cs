using BookingEngine.Api.Application.Availability;
using BookingEngine.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace BookingEngine.Api.Api.Endpoints;

public static class AvailabilityEndpoints
{
    public static void MapAvailabilityEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/availability", async (
            Guid resourceTypeId,
            DateTimeOffset from,
            DateTimeOffset to,
            BookingEngineDbContext db) =>
        {
            if (to < from)
            {
                return Results.BadRequest(new { message = "'to' must not be before 'from'." });
            }

            // Grouping into "ahora" / "más tarde" is a client concern — this
            // returns a flat list ordered by start time, per the handoff.
            var slots = await db.AvailabilitySlots
                .AsNoTracking()
                .Where(s =>
                    s.Resource.ResourceTypeId == resourceTypeId &&
                    s.StartsAt >= from &&
                    s.StartsAt <= to)
                .OrderBy(s => s.StartsAt)
                .Select(s => new AvailabilitySlotResponse(
                    s.Id,
                    s.ResourceId,
                    s.Resource.Name,
                    s.Resource.ResourceTypeId,
                    s.Resource.Location.Name,
                    s.StartsAt,
                    s.EndsAt,
                    s.CapacityRemaining,
                    s.RowVersion))
                .ToListAsync();

            return Results.Ok(slots);
        })
        .WithName("GetAvailability");
    }
}
