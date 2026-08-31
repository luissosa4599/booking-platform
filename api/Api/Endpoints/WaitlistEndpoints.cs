using System.Security.Claims;
using BookingEngine.Api.Application.Auth;
using BookingEngine.Api.Application.Validation;
using BookingEngine.Api.Application.Waitlist;
using BookingEngine.Api.Domain;
using BookingEngine.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace BookingEngine.Api.Api.Endpoints;

public static class WaitlistEndpoints
{
    public static void MapWaitlistEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/waitlist", async (ClaimsPrincipal principal, BookingEngineDbContext db) =>
        {
            var userId = principal.UserId();
            var entries = await db.WaitlistEntries
                .AsNoTracking()
                .Where(w => w.UserId == userId)
                .OrderBy(w => w.AvailabilitySlot.StartsAt)
                .Select(w => new WaitlistEntryDetailResponse(
                    w.Id,
                    w.AvailabilitySlotId,
                    w.AvailabilitySlot.ResourceId,
                    w.AvailabilitySlot.Resource.Name,
                    w.AvailabilitySlot.Resource.Location.Name,
                    w.AvailabilitySlot.StartsAt,
                    w.AvailabilitySlot.EndsAt,
                    // 1-indexed: how many entries for this slot were created no
                    // later than this one. Computed on read — see WaitlistEntryConfiguration.
                    db.WaitlistEntries.Count(o =>
                        o.AvailabilitySlotId == w.AvailabilitySlotId && o.CreatedAt <= w.CreatedAt)))
                .ToListAsync();

            return Results.Ok(entries);
        })
        .RequireAuthorization()
        .WithName("GetMyWaitlist");

        app.MapPost("/waitlist", async (
            JoinWaitlistRequest request,
            ClaimsPrincipal principal,
            BookingEngineDbContext db,
            ILogger<Program> logger) =>
        {
            var userId = principal.UserId();
            var slot = await db.AvailabilitySlots
                .Include(s => s.Resource)
                .ThenInclude(r => r.ResourceType)
                .FirstOrDefaultAsync(s => s.Id == request.AvailabilitySlotId);

            if (slot is null)
            {
                return Results.NotFound(new { message = "Availability slot not found." });
            }

            if (!slot.Resource.ResourceType.AllowsWaitlist)
            {
                return Results.BadRequest(new { message = "This resource type does not support a waitlist." });
            }

            if (slot.CapacityRemaining > 0)
            {
                return Results.BadRequest(new { message = "This slot still has capacity - book it instead of waiting." });
            }

            var existing = await db.WaitlistEntries
                .FirstOrDefaultAsync(w =>
                    w.AvailabilitySlotId == slot.Id && w.UserId == userId);

            var entry = existing;
            if (entry is null)
            {
                entry = new WaitlistEntry
                {
                    Id = Guid.NewGuid(),
                    AvailabilitySlotId = slot.Id,
                    UserId = userId,
                    CreatedAt = DateTimeOffset.UtcNow,
                };
                db.WaitlistEntries.Add(entry);
                await db.SaveChangesAsync();

                logger.LogInformation(
                    "{UserId} joined waitlist for slot {SlotId}",
                    userId,
                    slot.Id);
            }

            var position = await db.WaitlistEntries
                .CountAsync(w => w.AvailabilitySlotId == slot.Id && w.CreatedAt <= entry.CreatedAt);

            var response = new WaitlistEntryResponse(
                entry.Id,
                entry.AvailabilitySlotId,
                entry.UserId,
                entry.CreatedAt,
                position);

            // A repeat "Anotarme" for a slot the user is already on is a no-op,
            // not an error — return the existing entry with its current position.
            return existing is null
                ? Results.Created($"/waitlist/{entry.Id}", response)
                : Results.Ok(response);
        })
        .RequireAuthorization()
        .AddEndpointFilter<ValidationFilter<JoinWaitlistRequest>>()
        .WithName("JoinWaitlist");
    }
}
