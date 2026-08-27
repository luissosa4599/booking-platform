using BookingEngine.Api.Application.Availability;
using BookingEngine.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace BookingEngine.Api.Api.Endpoints;

public static class AvailabilityEndpoints
{
    public static void MapAvailabilityEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/availability", async (
            Guid? resourceTypeId,
            DateTimeOffset from,
            DateTimeOffset to,
            string? q,
            int? minCapacity,
            BookingEngineDbContext db) =>
        {
            if (to < from)
            {
                return Results.BadRequest(new { message = "'to' must not be before 'from'." });
            }

            var search = string.IsNullOrWhiteSpace(q) ? null : q.Trim();

            // resourceTypeId is optional — the UI's default "Cualquiera" filter
            // has no type to scope by, so omitting it means "all types".
            // Grouping into "ahora" / "más tarde" is a client concern — this
            // returns a flat list ordered by start time, per the handoff.
            //
            // Filtering on EndsAt (not StartsAt) >= from is deliberate: a slot
            // that started before `from` but hasn't ended yet is still
            // "ahora mismo" and must be included — filtering on StartsAt would
            // silently drop every currently-in-progress slot.
            IQueryable<BookingEngine.Api.Domain.AvailabilitySlot> query = db.AvailabilitySlots
                .AsNoTracking()
                .Where(s =>
                    (resourceTypeId == null || s.Resource.ResourceTypeId == resourceTypeId) &&
                    (minCapacity == null || s.Resource.Capacity >= minCapacity) &&
                    s.EndsAt >= from &&
                    s.StartsAt <= to);

            if (search is not null)
            {
                query = query.Where(s =>
                    EF.Functions.ILike(s.Resource.Name, $"%{search}%") ||
                    EF.Functions.ILike(s.Resource.Location.Name, $"%{search}%"));
            }

            var slots = await query
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

            EmptyContextResponse? emptyContext = slots.Count > 0
                ? null
                : await BuildEmptyContextAsync(db, resourceTypeId, from, search, minCapacity);

            return Results.Ok(new AvailabilityResponse(slots, emptyContext));
        })
        .WithName("GetAvailability");
    }

    private static async Task<EmptyContextResponse> BuildEmptyContextAsync(
        BookingEngineDbContext db,
        Guid? resourceTypeId,
        DateTimeOffset from,
        string? search,
        int? minCapacity)
    {
        var reason = search is not null
            ? "noResults"
            : (resourceTypeId is not null || minCapacity is not null) ? "filtered" : "noAvailability";

        // "Next available" deliberately relaxes the time window and the search
        // term — it answers "when could I get in?", keeping only the type and
        // capacity constraints the user actually set.
        var nextAvailableAt = await db.AvailabilitySlots
            .AsNoTracking()
            .Where(s =>
                (resourceTypeId == null || s.Resource.ResourceTypeId == resourceTypeId) &&
                (minCapacity == null || s.Resource.Capacity >= minCapacity) &&
                s.CapacityRemaining > 0 &&
                s.EndsAt >= from)
            .OrderBy(s => s.StartsAt)
            .Select(s => (DateTimeOffset?)s.StartsAt)
            .FirstOrDefaultAsync();

        // Kept ASCII-only, like the rest of this codebase's string literals —
        // the frontend owns the accented Spanish copy and composes the final
        // sentence from these tokens (design-handoff screen 06).
        string? blockingFilter = null;
        if (minCapacity is not null)
        {
            blockingFilter = $"aforo {minCapacity}+";
        }
        else if (search is not null)
        {
            blockingFilter = search;
        }
        else if (resourceTypeId is not null)
        {
            blockingFilter = await db.ResourceTypes
                .AsNoTracking()
                .Where(t => t.Id == resourceTypeId)
                .Select(t => t.Labels.Plural)
                .FirstOrDefaultAsync();
        }

        // Only meaningful for the plain "nothing free right now" case.
        string? occupancyNote = null;
        if (reason == "noAvailability")
        {
            var fullCount = await db.AvailabilitySlots
                .AsNoTracking()
                .CountAsync(s => s.StartsAt <= from && s.EndsAt >= from && s.CapacityRemaining == 0);

            if (fullCount > 0)
            {
                occupancyNote = $"{fullCount} espacios llenos en este horario.";
            }
        }

        return new EmptyContextResponse(reason, nextAvailableAt, blockingFilter, occupancyNote);
    }
}
