using System.Security.Claims;
using BookingEngine.Api.Application.Auth;
using BookingEngine.Api.Application.Checkins;
using BookingEngine.Api.Application.Validation;
using BookingEngine.Domain;
using BookingEngine.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace BookingEngine.Api.Api.Endpoints;

public static class CheckinsEndpoints
{
    // A booking can be checked in from 30 min before its slot starts...
    private static readonly TimeSpan EarlyWindow = TimeSpan.FromMinutes(30);

    public static void MapCheckinsEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/checkins", async (
            CheckinRequest request,
            ClaimsPrincipal principal,
            BookingEngineDbContext db,
            ILogger<Program> logger,
            CancellationToken ct) =>
        {
            var code = request.Code.Trim().ToUpperInvariant();
            var hostId = principal.UserId();

            var booking = await db.Bookings
                .Include(b => b.AvailabilitySlot).ThenInclude(s => s.Resource).ThenInclude(r => r.Location)
                .FirstOrDefaultAsync(b => b.Code == code, ct);

            if (booking is null)
            {
                return Results.NotFound(new CheckinResponse("unknown_code"));
            }

            var slot = booking.AvailabilitySlot;

            if (slot.Resource.OwnerUserId != hostId)
            {
                return Results.Json(
                    new CheckinResponse("wrong_space", SpaceName: slot.Resource.Name),
                    statusCode: StatusCodes.Status403Forbidden);
            }

            if (booking.Status == BookingStatus.Cancelled)
            {
                // A cancelled booking is not a valid pass — don't leak more than "unknown".
                return Results.NotFound(new CheckinResponse("unknown_code"));
            }

            var visitor = await db.Users
                .AsNoTracking()
                .Where(u => u.Id == booking.UserId)
                .Select(u => u.DisplayName ?? u.Email)
                .FirstOrDefaultAsync(ct);

            var now = DateTimeOffset.UtcNow;
            if (!request.Force && (now < slot.StartsAt - EarlyWindow || now > slot.EndsAt))
            {
                var direction = now < slot.StartsAt ? "future" : "past";
                return Results.Conflict(new CheckinResponse(
                    "out_of_window",
                    BookingId: booking.Id,
                    StartsAt: slot.StartsAt,
                    EndsAt: slot.EndsAt,
                    Direction: direction));
            }

            var body = new CheckinResponse(
                booking.CheckedInAt is null ? "confirmed" : "already_confirmed",
                BookingId: booking.Id,
                Code: booking.Code,
                VisitorName: visitor,
                SpaceName: slot.Resource.Name,
                LocationName: slot.Resource.Location.Name,
                StartsAt: slot.StartsAt,
                EndsAt: slot.EndsAt,
                Seats: booking.Seats,
                ConfirmedAt: booking.CheckedInAt ?? now);

            if (booking.CheckedInAt is null)
            {
                booking.CheckedInAt = now;
                booking.CheckedInByUserId = hostId;
                await db.SaveChangesAsync(ct);
                logger.LogInformation(
                    "Check-in {Code} for {Space} by {Host}{Forced}",
                    booking.Code, slot.Resource.Name, hostId, request.Force ? " (forced)" : "");
            }

            return Results.Ok(body);
        })
        .RequireAuthorization("Host")
        .AddEndpointFilter<ValidationFilter<CheckinRequest>>()
        .WithName("CreateCheckin");
    }
}
