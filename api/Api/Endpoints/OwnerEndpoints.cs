using System.Globalization;
using System.Security.Claims;
using BookingEngine.Api.Application.Auth;
using BookingEngine.Api.Application.Owner;
using BookingEngine.Api.Application.ResourceTypes;
using BookingEngine.Api.Application.Validation;
using BookingEngine.Api.Infrastructure.Storage;
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
                Latitude = request.LocationLatitude,
                Longitude = request.LocationLongitude,
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
            resource.Location.Latitude = request.LocationLatitude;
            resource.Location.Longitude = request.LocationLongitude;

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

            // Upsert day rows in place — deleting + re-inserting the same
            // (WeeklyScheduleId, Weekday) pairs in one SaveChanges trips the
            // unique index.
            var existing = schedule.Days.ToDictionary(d => d.Weekday);
            var wanted = new HashSet<DayOfWeek>();
            foreach (var input in request.Days)
            {
                var weekday = Enum.Parse<DayOfWeek>(input.Weekday, ignoreCase: true);
                wanted.Add(weekday);
                var open = TimeOnly.Parse(input.OpenTime, CultureInfo.InvariantCulture);
                var close = TimeOnly.Parse(input.CloseTime, CultureInfo.InvariantCulture);

                if (existing.TryGetValue(weekday, out var row))
                {
                    row.OpenTime = open;
                    row.CloseTime = close;
                    row.Enabled = input.Enabled;
                }
                else
                {
                    schedule.Days.Add(new WeeklyScheduleDay
                    {
                        Id = Guid.NewGuid(),
                        WeeklyScheduleId = schedule.Id,
                        Weekday = weekday,
                        OpenTime = open,
                        CloseTime = close,
                        Enabled = input.Enabled,
                    });
                }
            }
            db.WeeklyScheduleDays.RemoveRange(
                schedule.Days.Where(d => !wanted.Contains(d.Weekday)).ToList());

            await db.SaveChangesAsync(ct);

            await ExpandAndPruneAsync(db, resource.Id, resource.Location.TimeZone, now, ct);

            var refreshed = await LoadOwnedAsync(db, resource.Id, principal.UserId(), ct);
            return Results.Ok(ToDetail(refreshed!));
        })
        .AddEndpointFilter<ValidationFilter<SetScheduleRequest>>()
        .WithName("SetOwnerSchedule");

        // --- Ad-hoc slots + blocking (PR B2) --------------------------------

        group.MapPost("/spaces/{id:guid}/slots", async (
            Guid id, AddSlotRequest request, ClaimsPrincipal principal, BookingEngineDbContext db, CancellationToken ct) =>
        {
            var resource = await db.Resources
                .FirstOrDefaultAsync(r => r.Id == id && r.OwnerUserId == principal.UserId(), ct);
            if (resource is null)
            {
                return Results.NotFound();
            }

            if (request.StartsAt <= DateTimeOffset.UtcNow)
            {
                return Results.BadRequest(new { message = "Start time must be in the future." });
            }

            var duplicate = await db.AvailabilitySlots.AnyAsync(
                s => s.ResourceId == id && s.StartsAt == request.StartsAt, ct);
            if (duplicate)
            {
                return Results.Conflict(new { message = "A slot already starts at that time." });
            }

            db.AvailabilitySlots.Add(new AvailabilitySlot
            {
                Id = Guid.NewGuid(),
                ResourceId = id,
                StartsAt = request.StartsAt,
                EndsAt = request.EndsAt,
                CapacityRemaining = request.Capacity,
                Origin = SlotOrigin.Adhoc,
                IsBlocked = false,
            });
            await db.SaveChangesAsync(ct);

            var refreshed = await LoadOwnedAsync(db, id, principal.UserId(), ct);
            return Results.Ok(ToDetail(refreshed!));
        })
        .AddEndpointFilter<ValidationFilter<AddSlotRequest>>()
        .WithName("AddOwnerSlot");

        group.MapDelete("/spaces/{id:guid}/slots/{slotId:guid}", async (
            Guid id, Guid slotId, ClaimsPrincipal principal, BookingEngineDbContext db, CancellationToken ct) =>
        {
            var slot = await LoadOwnedSlotAsync(db, id, slotId, principal.UserId(), ct);
            if (slot is null)
            {
                return Results.NotFound();
            }

            if (slot.Bookings.Any(b => b.Status == BookingStatus.Confirmed))
            {
                return Results.Conflict(new { message = "This slot has active bookings." });
            }

            db.AvailabilitySlots.Remove(slot);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        })
        .WithName("DeleteOwnerSlot");

        group.MapPost("/spaces/{id:guid}/slots/{slotId:guid}/block", async (
            Guid id, Guid slotId, BlockSlotRequest request, ClaimsPrincipal principal,
            BookingEngineDbContext db, ILogger<Program> logger, CancellationToken ct) =>
        {
            var slot = await LoadOwnedSlotAsync(db, id, slotId, principal.UserId(), ct);
            if (slot is null)
            {
                return Results.NotFound();
            }

            var confirmed = slot.Bookings.Where(b => b.Status == BookingStatus.Confirmed).ToList();
            if (confirmed.Count > 0 && !request.Force)
            {
                return Results.Conflict(new { bookings = confirmed.Count });
            }

            slot.IsBlocked = true;
            foreach (var booking in confirmed)
            {
                booking.Status = BookingStatus.Cancelled;
                slot.CapacityRemaining += booking.Seats;
            }

            if (confirmed.Count > 0)
            {
                // One outbox row per slot; the worker fans out to every booker
                // whose booking was just cancelled and isn't already notified.
                db.NotificationOutbox.Add(new NotificationOutbox
                {
                    Id = Guid.NewGuid(),
                    Type = NotificationType.BookingCancelledByHost,
                    AvailabilitySlotId = slot.Id,
                    CreatedAt = DateTimeOffset.UtcNow,
                });
            }

            await db.SaveChangesAsync(ct);
            logger.LogInformation(
                "Slot {SlotId} blocked by {UserId}, cancelled {Count} booking(s)",
                slot.Id, principal.UserId(), confirmed.Count);
            return Results.NoContent();
        })
        .WithName("BlockOwnerSlot");

        group.MapPost("/spaces/{id:guid}/slots/{slotId:guid}/unblock", async (
            Guid id, Guid slotId, ClaimsPrincipal principal, BookingEngineDbContext db, CancellationToken ct) =>
        {
            var slot = await LoadOwnedSlotAsync(db, id, slotId, principal.UserId(), ct);
            if (slot is null)
            {
                return Results.NotFound();
            }

            slot.IsBlocked = false;
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        })
        .WithName("UnblockOwnerSlot");

        // --- Photos (PR3b) -------------------------------------------------

        group.MapPost("/spaces/{id:guid}/images/upload-url", async (
            Guid id, UploadUrlRequest request, ClaimsPrincipal principal,
            BookingEngineDbContext db, IImageStorage storage, CancellationToken ct) =>
        {
            var owns = await db.Resources.AnyAsync(
                r => r.Id == id && r.OwnerUserId == principal.UserId(), ct);
            if (!owns)
            {
                return Results.NotFound();
            }

            if (!storage.Enabled)
            {
                return Results.Problem(
                    statusCode: StatusCodes.Status503ServiceUnavailable,
                    detail: "Image storage is not configured.");
            }

            var (uploadUrl, publicUrl) = await storage.CreateUploadUrlAsync(id, request.ContentType, ct);
            return Results.Ok(new UploadUrlResponse(uploadUrl, publicUrl));
        })
        .AddEndpointFilter<ValidationFilter<UploadUrlRequest>>()
        .WithName("CreateOwnerImageUploadUrl");

        group.MapPost("/spaces/{id:guid}/images", async (
            Guid id, AddImageRequest request, ClaimsPrincipal principal,
            BookingEngineDbContext db, IImageStorage storage, CancellationToken ct) =>
        {
            var resource = await LoadOwnedWithImagesAsync(db, id, principal.UserId(), ct);
            if (resource is null)
            {
                return Results.NotFound();
            }

            if (!storage.OwnsUrl(id, request.Url))
            {
                return Results.BadRequest(new { message = "That URL is not an upload for this space." });
            }

            var nextPosition = resource.Images.Count == 0
                ? 0
                : resource.Images.Max(i => i.Position) + 1;

            db.ResourceImages.Add(new ResourceImage
            {
                Id = Guid.NewGuid(),
                ResourceId = id,
                Url = request.Url,
                Position = nextPosition,
                CreatedAt = DateTimeOffset.UtcNow,
            });
            await db.SaveChangesAsync(ct);

            return Results.Ok(await ImageListAsync(db, id, ct));
        })
        .AddEndpointFilter<ValidationFilter<AddImageRequest>>()
        .WithName("AddOwnerImage");

        group.MapDelete("/spaces/{id:guid}/images/{imageId:guid}", async (
            Guid id, Guid imageId, ClaimsPrincipal principal,
            BookingEngineDbContext db, CancellationToken ct) =>
        {
            var resource = await LoadOwnedWithImagesAsync(db, id, principal.UserId(), ct);
            if (resource is null)
            {
                return Results.NotFound();
            }

            var image = resource.Images.FirstOrDefault(i => i.Id == imageId);
            if (image is not null)
            {
                db.ResourceImages.Remove(image);
                // Re-pack positions contiguously.
                var remaining = resource.Images
                    .Where(i => i.Id != imageId)
                    .OrderBy(i => i.Position)
                    .ToList();
                for (var p = 0; p < remaining.Count; p++)
                {
                    remaining[p].Position = p;
                }
                await db.SaveChangesAsync(ct);
            }

            return Results.Ok(await ImageListAsync(db, id, ct));
        })
        .WithName("DeleteOwnerImage");

        group.MapPut("/spaces/{id:guid}/images/order", async (
            Guid id, ReorderImagesRequest request, ClaimsPrincipal principal,
            BookingEngineDbContext db, CancellationToken ct) =>
        {
            var resource = await LoadOwnedWithImagesAsync(db, id, principal.UserId(), ct);
            if (resource is null)
            {
                return Results.NotFound();
            }

            var byId = resource.Images.ToDictionary(i => i.Id);
            var position = 0;
            foreach (var imageId in request.ImageIds)
            {
                if (byId.TryGetValue(imageId, out var image))
                {
                    image.Position = position++;
                }
            }
            // Anything the request didn't mention keeps a stable relative order after.
            foreach (var image in resource.Images
                .Where(i => !request.ImageIds.Contains(i.Id))
                .OrderBy(i => i.Position))
            {
                image.Position = position++;
            }
            await db.SaveChangesAsync(ct);

            return Results.Ok(await ImageListAsync(db, id, ct));
        })
        .AddEndpointFilter<ValidationFilter<ReorderImagesRequest>>()
        .WithName("ReorderOwnerImages");
    }

    private static Task<Resource?> LoadOwnedWithImagesAsync(
        BookingEngineDbContext db, Guid id, string userId, CancellationToken ct) =>
        db.Resources
            .Include(r => r.Images)
            .FirstOrDefaultAsync(r => r.Id == id && r.OwnerUserId == userId, ct);

    private static async Task<List<ResourceImageResponse>> ImageListAsync(
        BookingEngineDbContext db, Guid resourceId, CancellationToken ct) =>
        await db.ResourceImages
            .AsNoTracking()
            .Where(i => i.ResourceId == resourceId)
            .OrderBy(i => i.Position)
            .Select(i => new ResourceImageResponse(i.Id, i.Url, i.Position))
            .ToListAsync(ct);

    private static Task<AvailabilitySlot?> LoadOwnedSlotAsync(
        BookingEngineDbContext db, Guid resourceId, Guid slotId, string userId, CancellationToken ct) =>
        db.AvailabilitySlots
            .Include(s => s.Bookings)
            .FirstOrDefaultAsync(
                s => s.Id == slotId
                    && s.ResourceId == resourceId
                    && s.Resource.OwnerUserId == userId,
                ct);

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
            .Include(r => r.Images)
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

        var images = r.Images
            .OrderBy(i => i.Position)
            .Select(i => new ResourceImageResponse(i.Id, i.Url, i.Position))
            .ToList();

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
            r.Location.Latitude,
            r.Location.Longitude,
            r.Location.TimeZone,
            images,
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
