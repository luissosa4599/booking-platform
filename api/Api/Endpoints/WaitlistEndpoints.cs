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
        app.MapPost("/waitlist", async (
            JoinWaitlistRequest request,
            BookingEngineDbContext db,
            ILogger<Program> logger) =>
        {
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

            var entry = new WaitlistEntry
            {
                Id = Guid.NewGuid(),
                AvailabilitySlotId = slot.Id,
                UserId = request.UserId,
                CreatedAt = DateTimeOffset.UtcNow,
            };
            db.WaitlistEntries.Add(entry);

            await db.SaveChangesAsync();

            logger.LogInformation(
                "{UserId} joined waitlist for slot {SlotId}",
                request.UserId,
                slot.Id);

            var response = new WaitlistEntryResponse(entry.Id, entry.AvailabilitySlotId, entry.UserId, entry.CreatedAt);

            return Results.Created($"/waitlist/{entry.Id}", response);
        })
        .AddEndpointFilter<ValidationFilter<JoinWaitlistRequest>>()
        .WithName("JoinWaitlist");
    }
}
