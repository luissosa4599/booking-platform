using System.Security.Claims;
using BookingEngine.Api.Application.Auth;
using BookingEngine.Api.Application.Bookings;
using BookingEngine.Api.Application.Me;
using BookingEngine.Domain;
using BookingEngine.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace BookingEngine.Api.Api.Endpoints;

public static class MeEndpoints
{
    public static void MapMeEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/me", async (
            ClaimsPrincipal principal,
            BookingEngineDbContext db,
            CancellationToken ct) =>
        {
            var userId = principal.UserId();
            var user = await db.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == userId, ct);
            if (user is null)
            {
                return Results.NotFound();
            }

            var bookingCount = await db.Bookings
                .AsNoTracking()
                .CountAsync(b => b.UserId == userId && b.Status != BookingStatus.Cancelled, ct);

            var confirmedStarts = await db.Bookings
                .AsNoTracking()
                .Where(b => b.UserId == userId && b.Status == BookingStatus.Confirmed)
                .Select(b => b.AvailabilitySlot.StartsAt)
                .ToListAsync(ct);

            var streak = BookingStreak.Count(confirmedStarts, DateTimeOffset.UtcNow);

            return Results.Ok(new MeResponse(
                user.Id,
                user.Email,
                user.DisplayName,
                user.AvatarUrl,
                user.Role.ToString().ToLowerInvariant(),
                bookingCount,
                streak,
                user.CreatedAt));
        })
        .RequireAuthorization()
        .WithName("GetMe");

        // Self-service upgrade, no approval. Re-issues the session so the returned
        // access token carries role=host immediately (the caller's old token would
        // otherwise keep saying guest for up to the access-token lifetime).
        // Idempotent: an already-host caller still gets a fresh session back.
        app.MapPost("/me/become-host", async (
            ClaimsPrincipal principal,
            SessionIssuer issuer,
            BookingEngineDbContext db,
            ILogger<Program> logger,
            CancellationToken ct) =>
        {
            var userId = principal.UserId();
            var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
            if (user is null)
            {
                return Results.NotFound();
            }

            var now = DateTimeOffset.UtcNow;
            if (user.Role != AccountRole.Host)
            {
                user.Role = AccountRole.Host;
                logger.LogInformation("User {UserId} upgraded to host", user.Id);
            }

            user.LastSeenAt = now;

            var session = await issuer.IssueAsync(db, user, now, ct);
            return Results.Ok(session);
        })
        .RequireAuthorization()
        .WithName("BecomeHost");
    }
}
