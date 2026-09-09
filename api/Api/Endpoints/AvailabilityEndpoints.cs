using BookingEngine.Api.Application.Availability;
using BookingEngine.Infrastructure;
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
            double? lat,
            double? lng,
            string? sort,
            BookingEngineDbContext db) =>
        {
            if (to < from)
            {
                return Results.BadRequest(new { message = "'to' must not be before 'from'." });
            }

            var search = string.IsNullOrWhiteSpace(q) ? null : q.Trim();

            // "soonest" (the default) = the historical behaviour. "nearest" only
            // engages when the caller passed both coordinates.
            var sortMode = sort switch
            {
                "nearest" when lat is not null && lng is not null => "nearest",
                "name" => "name",
                "capacity" => "capacity",
                _ => "soonest",
            };
            var originLat = lat ?? 0;
            var originLng = lng ?? 0;
            // Longitude degrees shrink toward the poles — scale them by cos(lat)
            // so the planar comparison below is roughly isotropic. Computed C#-side
            // so only +/-/* on mapped columns reach SQL (no trig → no acos domain
            // errors, no fragile SQL over a nullable column).
            var cosLat = Math.Cos(originLat * Math.PI / 180.0);

            // resourceTypeId is optional — the UI's default "Cualquiera" filter
            // has no type to scope by, so omitting it means "all types".
            // Grouping into "ahora" / "más tarde" is a client concern — this
            // returns a flat list ordered by start time, per the handoff.
            //
            // Filtering on EndsAt (not StartsAt) >= from is deliberate: a slot
            // that started before `from` but hasn't ended yet is still
            // "ahora mismo" and must be included — filtering on StartsAt would
            // silently drop every currently-in-progress slot.
            IQueryable<BookingEngine.Domain.AvailabilitySlot> query = db.AvailabilitySlots
                .AsNoTracking()
                .Where(s =>
                    !s.IsBlocked &&
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

            query = sortMode switch
            {
                "nearest" => query
                    .OrderBy(s => s.Resource.Location.Latitude == null
                        || s.Resource.Location.Longitude == null ? 1 : 0)
                    .ThenBy(s =>
                        ((s.Resource.Location.Longitude!.Value - originLng) * cosLat)
                            * ((s.Resource.Location.Longitude!.Value - originLng) * cosLat)
                        + (s.Resource.Location.Latitude!.Value - originLat)
                            * (s.Resource.Location.Latitude!.Value - originLat))
                    .ThenBy(s => s.StartsAt),
                "name" => query.OrderBy(s => s.Resource.Name).ThenBy(s => s.StartsAt),
                "capacity" => query
                    .OrderByDescending(s => s.Resource.Capacity)
                    .ThenBy(s => s.StartsAt),
                _ => query.OrderBy(s => s.StartsAt),
            };

            var rows = await query
                .Select(s => new
                {
                    s.Id,
                    s.ResourceId,
                    ResourceName = s.Resource.Name,
                    s.Resource.ResourceTypeId,
                    LocationName = s.Resource.Location.Name,
                    s.StartsAt,
                    s.EndsAt,
                    s.CapacityRemaining,
                    s.RowVersion,
                    Lat = s.Resource.Location.Latitude,
                    Lng = s.Resource.Location.Longitude,
                })
                .ToListAsync();

            var slots = rows
                .Select(r => new AvailabilitySlotResponse(
                    r.Id,
                    r.ResourceId,
                    r.ResourceName,
                    r.ResourceTypeId,
                    r.LocationName,
                    r.StartsAt,
                    r.EndsAt,
                    r.CapacityRemaining,
                    r.RowVersion,
                    sortMode == "nearest" && r.Lat is not null && r.Lng is not null
                        ? HaversineMeters(originLat, originLng, r.Lat.Value, r.Lng.Value)
                        : null,
                    r.Lat,
                    r.Lng))
                .ToList();

            EmptyContextResponse? emptyContext = slots.Count > 0
                ? null
                : await BuildEmptyContextAsync(db, resourceTypeId, from, search, minCapacity);

            return Results.Ok(new AvailabilityResponse(slots, emptyContext));
        })
        .WithName("GetAvailability");
    }

    // Accurate great-circle distance, computed in memory (not SQL) so there's no
    // trig for Npgsql to translate and no acos() domain risk on identical points.
    private static double HaversineMeters(double lat1, double lon1, double lat2, double lon2)
    {
        const double earthRadiusMeters = 6_371_000;
        var p = Math.PI / 180.0;
        var a = 0.5
            - Math.Cos((lat2 - lat1) * p) / 2
            + Math.Cos(lat1 * p) * Math.Cos(lat2 * p) * (1 - Math.Cos((lon2 - lon1) * p)) / 2;
        return 2 * earthRadiusMeters * Math.Asin(Math.Sqrt(a));
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
                !s.IsBlocked &&
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
