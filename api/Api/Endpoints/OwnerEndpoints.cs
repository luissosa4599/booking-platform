using System.Globalization;
using System.Security.Claims;
using BookingEngine.Api.Application.Auth;
using BookingEngine.Api.Application.Owner;
using BookingEngine.Api.Application.ResourceTypes;
using BookingEngine.Api.Application.Validation;
using BookingEngine.Domain;
using BookingEngine.Infrastructure;
using BookingEngine.Infrastructure.Availability;
using Microsoft.EntityFrameworkCore;

namespace BookingEngine.Api.Api.Endpoints;

public static class OwnerEndpoints
{
    public static void MapOwnerEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/owner").RequireAuthorization("Host");

        group.MapGet("/spaces", async (ClaimsPrincipal principal, BookingEngineDbContext db, CancellationToken ct) =>
        {
            var userId = principal.UserId();
            var weekOut = DateTimeOffset.UtcNow.AddDays(7);

            var spaces = await db.Resources
                .AsNoTracking()
                .Where(r => r.OwnerUserId == userId)
                .OrderBy(r => r.Name)
                .Select(r => new OwnerSpaceSummary(
                    r.Id,
                    r.Name,
                    r.Location.Name,
                    r.Location.Address,
                    r.AvailabilitySlots.Count(s =>
                        !s.IsBlocked
                        && s.StartsAt >= DateTimeOffset.UtcNow
                        && s.StartsAt <= weekOut),
                    r.WeeklySchedule != null))
                .ToListAsync(ct);

            return Results.Ok(spaces);
        })
        .WithName("GetOwnerSpaces");

        group.MapGet("/spaces/{id:guid}", async (
            Guid id, ClaimsPrincipal principal, BookingEngineDbContext db, CancellationToken ct) =>
        {
            var resource = await LoadOwnedAsync(db, id, principal.UserId(), ct);
            return resource is null ? Results.NotFound() : Results.Ok(ToDetail(resource));
        })
        .WithName("GetOwnerSpace");

        group.MapPost("/spaces", async (
            CreateSpaceRequest request, ClaimsPrincipal principal, BookingEngineDbContext db, CancellationToken ct) =>
        {
            var userId = principal.UserId();

            if (!TryResolveTimeZone(request.TimeZone))
            {
                return Results.BadRequest(new { message = "Unknown time zone." });
            }

            var type = await db.ResourceTypes.FirstOrDefaultAsync(t => t.Id == request.ResourceTypeId, ct);
            if (type is null)
            {
                return Results.BadRequest(new { message = "Unknown resource type." });
            }

            var capacity = type.AllowsMultipleSeats ? request.Capacity : 1;

            var location = new Location
            {
                Id = Guid.NewGuid(),
                Name = request.LocationName.Trim(),
                Address = string.IsNullOrWhiteSpace(request.Address) ? null : request.Address.Trim(),
                TimeZone = request.TimeZone,
                OwnerUserId = userId,
            };
            var resource = new Resource
            {
                Id = Guid.NewGuid(),
                ResourceTypeId = type.Id,
                Location = location,
                Name = request.Name.Trim(),
                Capacity = capacity,
                Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description!.Trim(),
                OwnerUserId = userId,
            };

            db.Locations.Add(location);
            db.Resources.Add(resource);
            await db.SaveChangesAsync(ct);

            var created = await LoadOwnedAsync(db, resource.Id, userId, ct);
            return Results.Created($"/owner/spaces/{resource.Id}", ToDetail(created!));
        })
        .AddEndpointFilter<ValidationFilter<CreateSpaceRequest>>()
        .WithName("CreateOwnerSpace");

        group.MapPatch("/spaces/{id:guid}", async (
            Guid id, UpdateSpaceRequest request, ClaimsPrincipal principal, BookingEngineDbContext db, CancellationToken ct) =>
        {
            var resource = await LoadOwnedAsync(db, id, principal.UserId(), ct);
            if (resource is null)
            {
                return Results.NotFound();
            }

            var type = resource.ResourceType;
            resource.Name = request.Name.Trim();
            resource.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description!.Trim();
            resource.Capacity = type.AllowsMultipleSeats ? request.Capacity : 1;
            resource.Location.Address = string.IsNullOrWhiteSpace(request.Address) ? null : request.Address!.Trim();

            await db.SaveChangesAsync(ct);
            return Results.Ok(ToDetail(resource));
        })
        .AddEndpointFilter<ValidationFilter<UpdateSpaceRequest>>()
        .WithName("UpdateOwnerSpace");

        group.MapPut("/spaces/{id:guid}/schedule", async (
            Guid id, SetScheduleRequest request, ClaimsPrincipal principal, BookingEngineDbContext db, CancellationToken ct) =>
        {
            var resource = await LoadOwnedAsync(db, id, principal.UserId(), ct);
            if (resource is null)
            {
                return Results.NotFound();
            }

            var now = DateTimeOffset.UtcNow;
            var schedule = resource.WeeklySchedule;
            if (schedule is null)
            {
                schedule = new WeeklySchedule { Id = Guid.NewGuid(), ResourceId = resource.Id };
                db.WeeklySchedules.Add(schedule);
                resource.WeeklySchedule = schedule;
            }

            schedule.SlotDurationMinutes = request.SlotDurationMinutes;
            schedule.Capacity = request.Capacity;
            schedule.UpdatedAt = now;

            // Full replace of the day rows.
            db.WeeklyScheduleDays.RemoveRange(schedule.Days);
            schedule.Days = request.Days
                .Select(d => new WeeklyScheduleDay
                {
                    Id = Guid.NewGuid(),
                    WeeklyScheduleId = schedule.Id,
                    Weekday = Enum.Parse<DayOfWeek>(d.Weekday, ignoreCase: true),
                    OpenTime = TimeOnly.Parse(d.OpenTime, CultureInfo.InvariantCulture),
                    CloseTime = TimeOnly.Parse(d.CloseTime, CultureInfo.InvariantCulture),
                    Enabled = d.Enabled,
                })
                .ToList();

            await db.SaveChangesAsync(ct);

            await ExpandAndPruneAsync(db, resource.Id, resource.Location.TimeZone, now, ct);

            var refreshed = await LoadOwnedAsync(db, resource.Id, principal.UserId(), ct);
            return Results.Ok(ToDetail(refreshed!));
        })
        .AddEndpointFilter<ValidationFilter<SetScheduleRequest>>()
        .WithName("SetOwnerSchedule");
    }

    // Regenerates the schedule window for one resource: adds missing slots and
    // deletes now-orphaned schedule slots that have no bookings. Shared shape
    // with the worker's ScheduleExpansionService.
    public static async Task ExpandAndPruneAsync(
        BookingEngineDbContext db, Guid resourceId, string timeZone, DateTimeOffset now, CancellationToken ct)
    {
        var schedule = await db.WeeklySchedules
            .Include(w => w.Days)
            .FirstOrDefaultAsync(w => w.ResourceId == resourceId, ct);
        if (schedule is null)
        {
            return;
        }

        var slots = await db.AvailabilitySlots
            .Include(s => s.Bookings)
            .Where(s => s.ResourceId == resourceId && s.EndsAt >= now)
            .ToListAsync(ct);

        var toAdd = SlotWindowExpander.Expand(resourceId, timeZone, schedule, slots, now);
        if (toAdd.Count > 0)
        {
            db.AvailabilitySlots.AddRange(toAdd);
        }

        var toRemove = slots
            .Where(s => SlotWindowExpander.IsOrphanedScheduleSlot(s, timeZone, schedule))
            .ToList();
        if (toRemove.Count > 0)
        {
            db.AvailabilitySlots.RemoveRange(toRemove);
        }

        if (toAdd.Count > 0 || toRemove.Count > 0)
        {
            await db.SaveChangesAsync(ct);
        }
    }

    private static Task<Resource?> LoadOwnedAsync(
        BookingEngineDbContext db, Guid id, string userId, CancellationToken ct) =>
        db.Resources
            .Include(r => r.ResourceType)
            .Include(r => r.Location)
            .Include(r => r.WeeklySchedule!)
                .ThenInclude(w => w.Days)
            .Include(r => r.AvailabilitySlots.Where(s => s.EndsAt >= DateTimeOffset.UtcNow))
                .ThenInclude(s => s.Bookings)
            .FirstOrDefaultAsync(r => r.Id == id && r.OwnerUserId == userId, ct);

    private static OwnerSpaceDetailResponse ToDetail(Resource r)
    {
        var slots = r.AvailabilitySlots
            .OrderBy(s => s.StartsAt)
            .Select(s => new OwnerSlotResponse(
                s.Id,
                s.StartsAt,
                s.EndsAt,
                s.CapacityRemaining + s.Bookings.Where(b => b.Status == BookingStatus.Confirmed).Sum(b => b.Seats),
                s.Bookings.Where(b => b.Status == BookingStatus.Confirmed).Sum(b => b.Seats),
                s.IsBlocked,
                s.Origin.ToString()))
            .ToList();

        WeeklyScheduleResponse? schedule = r.WeeklySchedule is null
            ? null
            : new WeeklyScheduleResponse(
                r.WeeklySchedule.SlotDurationMinutes,
                r.WeeklySchedule.Capacity,
                r.WeeklySchedule.Days
                    .OrderBy(d => ((int)d.Weekday + 6) % 7) // Monday-first
                    .Select(d => new WeeklyScheduleDayResponse(
                        d.Weekday.ToString(),
                        d.OpenTime.ToString("HH:mm", CultureInfo.InvariantCulture),
                        d.CloseTime.ToString("HH:mm", CultureInfo.InvariantCulture),
                        d.Enabled))
                    .ToList());

        return new OwnerSpaceDetailResponse(
            r.Id,
            r.Name,
            r.Description,
            r.Capacity,
            r.ResourceTypeId,
            r.ResourceType.Name,
            new ResourceLabelsResponse(
                r.ResourceType.Labels.Singular,
                r.ResourceType.Labels.Plural,
                r.ResourceType.Labels.CapacityUnit,
                r.ResourceType.Labels.ActionVerb),
            r.ResourceType.AllowsMultipleSeats,
            r.LocationId,
            r.Location.Name,
            r.Location.Address,
            r.Location.TimeZone,
            schedule,
            slots);
    }

    private static bool TryResolveTimeZone(string ianaId)
    {
        try
        {
            _ = TimeZoneInfo.FindSystemTimeZoneById(ianaId);
            return true;
        }
        catch (Exception ex) when (ex is TimeZoneNotFoundException or InvalidTimeZoneException)
        {
            return false;
        }
    }
}
