using System.Net;
using System.Net.Http.Json;
using BookingEngine.Api.Application.Notifications;
using BookingEngine.Domain;
using BookingEngine.Infrastructure;
using Microsoft.Extensions.DependencyInjection;

namespace BookingEngine.Api.Tests;

[Collection("Api")]
public class NotificationsEndpointsTests(ApiTestFixture fixture)
{
    [Fact]
    public async Task GetNotifications_WithoutToken_Is401()
    {
        var response = await fixture.Factory.CreateClient().GetAsync("/notifications");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetNotifications_ReturnsOwnRowsNewestFirst_WithUnreadCount()
    {
        using var scope = fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();

        var userId = "notif-user-a";
        var now = DateTimeOffset.UtcNow;
        db.SentNotifications.AddRange(
            new SentNotification
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Type = SentNotificationType.Reminder,
                ResourceName = "Older Room",
                SentAt = now.AddMinutes(-10),
            },
            new SentNotification
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Type = SentNotificationType.WaitlistSlotOpened,
                ResourceName = "Newer Room",
                SentAt = now,
            },
            // A different user's row must never leak into the response.
            new SentNotification
            {
                Id = Guid.NewGuid(),
                UserId = "notif-user-someone-else",
                Type = SentNotificationType.Reminder,
                ResourceName = "Not Mine",
                SentAt = now,
            });
        await db.SaveChangesAsync();

        var client = fixture.CreateAuthenticatedClient(userId);
        var result = await client.GetFromJsonAsync<NotificationsResponse>("/notifications");

        Assert.NotNull(result);
        Assert.Equal(2, result!.Notifications.Count);
        Assert.Equal(2, result.UnreadCount);
        Assert.Equal("Newer Room", result.Notifications[0].ResourceName);
        Assert.Equal("Older Room", result.Notifications[1].ResourceName);
        Assert.All(result.Notifications, n => Assert.False(n.IsRead));
    }

    [Fact]
    public async Task ReadAll_MarksOnlyCallersRows_AndUnreadCountDropsToZero()
    {
        using var scope = fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();

        var userId = "notif-user-b";
        var otherId = "notif-user-c";
        db.SentNotifications.AddRange(
            new SentNotification
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Type = SentNotificationType.Reminder,
                ResourceName = "Mine",
                SentAt = DateTimeOffset.UtcNow,
            },
            new SentNotification
            {
                Id = Guid.NewGuid(),
                UserId = otherId,
                Type = SentNotificationType.Reminder,
                ResourceName = "Theirs",
                SentAt = DateTimeOffset.UtcNow,
            });
        await db.SaveChangesAsync();

        var mine = fixture.CreateAuthenticatedClient(userId);
        var theirs = fixture.CreateAuthenticatedClient(otherId);

        var readAll = await mine.PostAsync("/notifications/read-all", null);
        Assert.Equal(HttpStatusCode.NoContent, readAll.StatusCode);

        var mineAfter = await mine.GetFromJsonAsync<NotificationsResponse>("/notifications");
        Assert.Equal(0, mineAfter!.UnreadCount);
        Assert.True(mineAfter.Notifications[0].IsRead);

        var theirsAfter = await theirs.GetFromJsonAsync<NotificationsResponse>("/notifications");
        Assert.Equal(1, theirsAfter!.UnreadCount);
        Assert.False(theirsAfter.Notifications[0].IsRead);
    }
}
