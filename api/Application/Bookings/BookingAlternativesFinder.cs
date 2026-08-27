using BookingEngine.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace BookingEngine.Api.Application.Bookings;

/// <summary>
/// Computes the "next best" slots to offer when a booking hits a 409 — the
/// data the ConflictSheet renders. Kept deliberately simple (no distance/geo
/// model): same resource at a nearby time first, then a different resource in
/// the same location at a nearby time. See docs/design-handoff.md, screen 07.
/// </summary>
public static class BookingAlternativesFinder
{
    private static readonly TimeSpan Window = TimeSpan.FromHours(3);
    private const int MaxAlternatives = 2;

    public static async Task<IReadOnlyList<BookingAlternative>> FindAsync(
        BookingEngineDbContext db,
        Guid conflictedSlotId,
        int seats,
        CancellationToken cancellationToken = default)
    {
        var target = await db.AvailabilitySlots
            .AsNoTracking()
            .Where(s => s.Id == conflictedSlotId)
            .Select(s => new
            {
                s.ResourceId,
                s.Resource.LocationId,
                s.StartsAt,
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (target is null)
        {
            return [];
        }

        var now = DateTimeOffset.UtcNow;
        var earliest = target.StartsAt - Window;
        var latest = target.StartsAt + Window;

        var candidates = await db.AvailabilitySlots
            .AsNoTracking()
            .Where(s =>
                s.Id != conflictedSlotId &&
                s.CapacityRemaining >= seats &&
                s.EndsAt >= now &&
                s.StartsAt >= earliest &&
                s.StartsAt <= latest &&
                (s.ResourceId == target.ResourceId || s.Resource.LocationId == target.LocationId))
            .Select(s => new
            {
                s.Id,
                ResourceName = s.Resource.Name,
                s.StartsAt,
                s.CapacityRemaining,
                SameResource = s.ResourceId == target.ResourceId,
                LocationName = s.Resource.Location.Name,
            })
            .ToListAsync(cancellationToken);

        return candidates
            // Same resource first, then whichever starts closest to the original time.
            .OrderByDescending(c => c.SameResource)
            .ThenBy(c => Math.Abs((c.StartsAt - target.StartsAt).Ticks))
            .Take(MaxAlternatives)
            .Select(c => new BookingAlternative(
                c.Id,
                c.ResourceName,
                c.StartsAt,
                c.CapacityRemaining,
                c.SameResource ? "Mismo espacio" : c.LocationName))
            .ToList();
    }
}
