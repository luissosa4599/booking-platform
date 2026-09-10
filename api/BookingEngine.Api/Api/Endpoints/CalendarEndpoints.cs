using System.Security.Claims;
using BookingEngine.Api.Application.Auth;
using BookingEngine.Api.Application.Calendar;
using BookingEngine.Api.Application.Validation;
using BookingEngine.Api.Infrastructure.Calendar;
using BookingEngine.Domain;
using BookingEngine.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace BookingEngine.Api.Api.Endpoints;

public static class CalendarEndpoints
{
    public static void MapCalendarEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/calendar").RequireAuthorization();

        group.MapGet("/status", async (
            ClaimsPrincipal principal,
            BookingEngineDbContext db,
            GoogleCalendarClient calendar,
            CancellationToken ct) =>
        {
            var userId = principal.UserId();
            var connected = await db.Users
                .Where(u => u.Id == userId && u.GoogleCalendarRefreshToken != null)
                .AnyAsync(ct);
            return Results.Ok(new CalendarStatusResponse(connected, calendar.Enabled));
        })
        .WithName("GetCalendarStatus");

        group.MapPost("/connect", async (
            CalendarConnectRequest request,
            ClaimsPrincipal principal,
            BookingEngineDbContext db,
            GoogleCalendarClient calendar,
            CalendarTokenCipher cipher,
            CancellationToken ct) =>
        {
            if (!calendar.Enabled)
            {
                return Results.Problem(
                    statusCode: StatusCodes.Status503ServiceUnavailable,
                    detail: "Google Calendar is not configured.");
            }

            var user = await db.Users.FirstOrDefaultAsync(u => u.Id == principal.UserId(), ct);
            if (user is null)
            {
                return Results.Unauthorized();
            }

            var (refreshToken, error) = await calendar.ExchangeCodeAsync(
                request.Code, request.CodeVerifier, request.RedirectUri, ct);
            if (refreshToken is null)
            {
                return Results.BadRequest(new { message = error ?? "connect_failed" });
            }

            user.GoogleCalendarRefreshToken = cipher.Encrypt(refreshToken);
            await db.SaveChangesAsync(ct);
            return Results.Ok(new CalendarStatusResponse(true, true));
        })
        .AddEndpointFilter<ValidationFilter<CalendarConnectRequest>>()
        .WithName("ConnectCalendar");

        group.MapPost("/disconnect", async (
            ClaimsPrincipal principal,
            BookingEngineDbContext db,
            GoogleCalendarClient calendar,
            CalendarTokenCipher cipher,
            CancellationToken ct) =>
        {
            var user = await db.Users.FirstOrDefaultAsync(u => u.Id == principal.UserId(), ct);
            if (user?.GoogleCalendarRefreshToken is { } stored)
            {
                var raw = cipher.Decrypt(stored);
                if (raw is not null)
                {
                    await calendar.RevokeAsync(raw, ct);
                }
                user.GoogleCalendarRefreshToken = null;
                await db.SaveChangesAsync(ct);
            }
            return Results.NoContent();
        })
        .WithName("DisconnectCalendar");

        group.MapPost("/events", async (
            CalendarEventRequest request,
            ClaimsPrincipal principal,
            BookingEngineDbContext db,
            GoogleCalendarClient calendar,
            CalendarTokenCipher cipher,
            CancellationToken ct) =>
        {
            var userId = principal.UserId();

            var booking = await db.Bookings
                .AsNoTracking()
                .Include(b => b.AvailabilitySlot).ThenInclude(s => s.Resource).ThenInclude(r => r.Location)
                .FirstOrDefaultAsync(b => b.Id == request.BookingId && b.UserId == userId, ct);
            if (booking is null || booking.Status != BookingStatus.Confirmed)
            {
                return Results.Ok(new CalendarEventResponse("not_found"));
            }

            var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
            var storedToken = user?.GoogleCalendarRefreshToken;
            var refreshToken = storedToken is null ? null : cipher.Decrypt(storedToken);
            if (refreshToken is null)
            {
                return Results.Ok(new CalendarEventResponse("not_connected"));
            }

            var accessToken = await calendar.RefreshAccessTokenAsync(refreshToken, ct);
            if (accessToken is null)
            {
                // Refresh token dead (revoked from Google's side) — forget it.
                if (user is not null)
                {
                    user.GoogleCalendarRefreshToken = null;
                    await db.SaveChangesAsync(ct);
                }
                return Results.Ok(new CalendarEventResponse("not_connected"));
            }

            var slot = booking.AvailabilitySlot;
            var resource = slot.Resource;
            var htmlLink = await calendar.CreateEventAsync(
                accessToken,
                summary: resource.Name,
                location: resource.Location.Address ?? resource.Location.Name,
                description: $"Codigo: {booking.Code}",
                startsAt: slot.StartsAt,
                endsAt: slot.EndsAt,
                ct);

            return htmlLink is null
                ? Results.Ok(new CalendarEventResponse("not_connected"))
                : Results.Ok(new CalendarEventResponse("created", htmlLink));
        })
        .AddEndpointFilter<ValidationFilter<CalendarEventRequest>>()
        .WithName("CreateCalendarEvent");
    }
}
