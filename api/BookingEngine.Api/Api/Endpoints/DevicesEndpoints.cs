using System.Security.Claims;
using BookingEngine.Api.Application.Auth;
using BookingEngine.Api.Application.Devices;
using BookingEngine.Api.Application.Validation;
using BookingEngine.Domain;
using BookingEngine.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace BookingEngine.Api.Api.Endpoints;

public static class DevicesEndpoints
{
    public static void MapDevicesEndpoints(this IEndpointRouteBuilder app)
    {
        // Registers (or refreshes) an Expo push token for the signed-in user's
        // device. The notification worker reads PushTokens directly — no
        // separate "unregister" endpoint; a token that stops working just
        // gets dropped by the worker on the first DeviceNotRegistered response.
        app.MapPost("/devices", async (
            RegisterDeviceRequest request,
            ClaimsPrincipal principal,
            BookingEngineDbContext db,
            CancellationToken ct) =>
        {
            var userId = principal.UserId();
            var now = DateTimeOffset.UtcNow;

            var existing = await db.PushTokens.FirstOrDefaultAsync(
                t => t.UserId == userId && t.ExpoPushToken == request.ExpoPushToken, ct);

            if (existing is null)
            {
                db.PushTokens.Add(new PushToken
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    ExpoPushToken = request.ExpoPushToken,
                    Platform = request.Platform,
                    UpdatedAt = now,
                });
            }
            else
            {
                existing.Platform = request.Platform;
                existing.UpdatedAt = now;
            }

            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        })
        .RequireAuthorization()
        .AddEndpointFilter<ValidationFilter<RegisterDeviceRequest>>()
        .WithName("RegisterDevice");
    }
}
