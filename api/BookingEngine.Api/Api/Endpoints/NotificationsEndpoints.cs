using System.Security.Claims;
using BookingEngine.Api.Application.Auth;
using BookingEngine.Api.Application.Notifications;
using BookingEngine.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace BookingEngine.Api.Api.Endpoints;

/// <summary>
/// The in-app notification center (bell icon on Explore) — reads
/// `SentNotification`, the same table the worker's `ReminderService`/
/// `WaitlistPromotionService` already write to as a dedupe log. This is the
/// first thing that reads those rows back out via the API; see the
/// `SentNotification` class comment for why display copy isn't stored here.
/// </summary>
public static class NotificationsEndpoints
{
    // Newest-first, capped — this is a recent-activity feed, not an archive.
    // Keeps the query cheap and the sheet's list short regardless of how long
    // an account has existed.
    private const int MaxReturned = 30;

    public static void MapNotificationsEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/notifications", async (
            ClaimsPrincipal principal,
            BookingEngineDbContext db,
            CancellationToken ct) =>
        {
            var userId = principal.UserId();

            var query = db.SentNotifications
                .AsNoTracking()
                .Where(n => n.UserId == userId);

            var unreadCount = await query.CountAsync(n => !n.IsRead, ct);

            var notifications = await query
                .OrderByDescending(n => n.SentAt)
                .Take(MaxReturned)
                .Select(n => new NotificationResponse(
                    n.Id,
                    n.Type,
                    n.ResourceName,
                    n.SlotStartsAt,
                    n.BookingId,
                    n.AvailabilitySlotId,
                    n.IsRead,
                    n.SentAt))
                .ToListAsync(ct);

            return Results.Ok(new NotificationsResponse(notifications, unreadCount));
        })
        .RequireAuthorization()
        .WithName("GetMyNotifications");

        // Mark-all, not mark-one — the sheet has no per-row "dismiss" action,
        // it's a scan-and-close list. Called when the sheet opens, so the
        // badge clears once the user has actually seen the feed.
        app.MapPost("/notifications/read-all", async (
            ClaimsPrincipal principal,
            BookingEngineDbContext db,
            CancellationToken ct) =>
        {
            var userId = principal.UserId();

            await db.SentNotifications
                .Where(n => n.UserId == userId && !n.IsRead)
                .ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true), ct);

            return Results.NoContent();
        })
        .RequireAuthorization()
        .WithName("MarkNotificationsRead");
    }
}
