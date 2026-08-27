using BookingEngine.Api.Application.Bookings;
using BookingEngine.Api.Application.Validation;
using BookingEngine.Api.Domain;
using BookingEngine.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace BookingEngine.Api.Api.Endpoints;

public static class BookingsEndpoints
{
    private const string IdempotencyKeyHeader = "Idempotency-Key";

    public static void MapBookingsEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/bookings", async (
            string userId,
            string scope,
            BookingEngineDbContext db) =>
        {
            if (scope is not ("upcoming" or "past"))
            {
                return Results.BadRequest(new { message = "'scope' must be 'upcoming' or 'past'." });
            }

            var now = DateTimeOffset.UtcNow;
            var query = db.Bookings.AsNoTracking().Where(b => b.UserId == userId);

            // A cancelled booking is never "upcoming" again regardless of
            // when its slot was — it belongs in history alongside completed
            // ones, same as the handoff's "ESTE MES" group shows both.
            query = scope == "upcoming"
                ? query.Where(b => b.Status == BookingStatus.Confirmed && b.AvailabilitySlot.EndsAt >= now)
                : query.Where(b => b.Status == BookingStatus.Cancelled || b.AvailabilitySlot.EndsAt < now);

            query = scope == "upcoming"
                ? query.OrderBy(b => b.AvailabilitySlot.StartsAt)
                : query.OrderByDescending(b => b.AvailabilitySlot.StartsAt);

            var bookings = await query
                .Select(b => new MyBookingResponse(
                    b.Id,
                    b.AvailabilitySlotId,
                    b.AvailabilitySlot.ResourceId,
                    b.AvailabilitySlot.Resource.Name,
                    b.AvailabilitySlot.Resource.Location.Name,
                    b.AvailabilitySlot.StartsAt,
                    b.AvailabilitySlot.EndsAt,
                    b.Seats,
                    b.Status.ToString(),
                    b.Code))
                .ToListAsync();

            return Results.Ok(bookings);
        })
        .WithName("GetMyBookings");

        // Consecutive-week booking streak for the confirmation screen's
        // "Octava semana seguida" line. Separate endpoint — it's cheap and only
        // one screen needs it.
        app.MapGet("/bookings/streak", async (string userId, BookingEngineDbContext db) =>
        {
            var starts = await db.Bookings
                .AsNoTracking()
                .Where(b => b.UserId == userId && b.Status == BookingStatus.Confirmed)
                .Select(b => b.AvailabilitySlot.StartsAt)
                .ToListAsync();

            return Results.Ok(new { weeks = BookingStreak.Count(starts, DateTimeOffset.UtcNow) });
        })
        .WithName("GetBookingStreak");

        app.MapPost("/bookings", async (
            CreateBookingRequest request,
            HttpRequest httpRequest,
            BookingEngineDbContext db,
            ILogger<Program> logger) =>
        {
            if (!httpRequest.Headers.TryGetValue(IdempotencyKeyHeader, out var headerValues) ||
                string.IsNullOrWhiteSpace(headerValues.FirstOrDefault()))
            {
                return Results.BadRequest(new { message = $"'{IdempotencyKeyHeader}' header is required." });
            }

            var idempotencyKey = headerValues.ToString();

            var existingBooking = await db.Bookings
                .AsNoTracking()
                .FirstOrDefaultAsync(b => b.IdempotencyKey == idempotencyKey);

            if (existingBooking is not null)
            {
                logger.LogInformation(
                    "Idempotent replay for key {IdempotencyKey}, returning existing booking {BookingId}",
                    idempotencyKey,
                    existingBooking.Id);

                return Results.Ok(ToResponse(existingBooking));
            }

            var slot = await db.AvailabilitySlots
                .Include(s => s.Resource)
                .FirstOrDefaultAsync(s => s.Id == request.AvailabilitySlotId);
            if (slot is null)
            {
                return Results.NotFound(new { message = "Availability slot not found." });
            }

            // Optional stale-read guard: the client tells us which version of
            // the slot it acted on; if the slot moved on since, reject before
            // writing rather than letting the xmin check fire mid-transaction.
            if (request.RowVersion is uint clientVersion && slot.RowVersion != clientVersion)
            {
                logger.LogWarning(
                    "Booking rejected — stale slot version for {SlotId} (client {ClientVersion}, current {CurrentVersion})",
                    slot.Id,
                    clientVersion,
                    slot.RowVersion);

                return Results.Conflict(new BookingConflictResponse(
                    "This slot changed since you loaded it.",
                    slot.Id,
                    await BookingAlternativesFinder.FindAsync(db, slot.Id, request.Seats)));
            }

            if (slot.CapacityRemaining < request.Seats)
            {
                logger.LogWarning(
                    "Booking rejected — insufficient capacity for slot {SlotId} (remaining {Remaining}, requested {Requested})",
                    slot.Id,
                    slot.CapacityRemaining,
                    request.Seats);

                return Results.Conflict(new BookingConflictResponse(
                    "This slot no longer has enough capacity.",
                    slot.Id,
                    await BookingAlternativesFinder.FindAsync(db, slot.Id, request.Seats)));
            }

            slot.CapacityRemaining -= request.Seats;

            var code = await GenerateUniqueCodeAsync(db, slot.Resource.Name);

            var booking = new Booking
            {
                Id = Guid.NewGuid(),
                AvailabilitySlotId = slot.Id,
                UserId = request.UserId,
                Seats = request.Seats,
                Status = BookingStatus.Confirmed,
                Code = code,
                IdempotencyKey = idempotencyKey,
                CreatedAt = DateTimeOffset.UtcNow,
            };
            db.Bookings.Add(booking);

            await using var transaction = await db.Database.BeginTransactionAsync();
            try
            {
                await db.SaveChangesAsync();
                await transaction.CommitAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                // The slot's xmin changed since we read it — someone else
                // booked (or cancelled into) it first. This is the case that
                // resolves a race for the last seat to exactly one 201 + one 409.
                await transaction.RollbackAsync();
                db.ChangeTracker.Clear();

                logger.LogWarning(
                    "Concurrency conflict booking slot {SlotId} for {UserId}",
                    request.AvailabilitySlotId,
                    request.UserId);

                return Results.Conflict(new BookingConflictResponse(
                    "Someone else just booked this slot.",
                    request.AvailabilitySlotId,
                    await BookingAlternativesFinder.FindAsync(db, request.AvailabilitySlotId, request.Seats)));
            }
            catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex))
            {
                // Two requests with the same Idempotency-Key both passed the
                // initial existence check and raced to insert; the unique
                // index on IdempotencyKey lets only one through. The loser
                // returns the winner's booking instead of erroring.
                await transaction.RollbackAsync();
                db.ChangeTracker.Clear();

                var winner = await db.Bookings
                    .AsNoTracking()
                    .FirstAsync(b => b.IdempotencyKey == idempotencyKey);

                logger.LogInformation(
                    "Idempotency-Key race for {IdempotencyKey}, returning winner {BookingId}",
                    idempotencyKey,
                    winner.Id);

                return Results.Ok(ToResponse(winner));
            }

            logger.LogInformation(
                "Booking {BookingId} ({Code}) created for slot {SlotId} by {UserId}",
                booking.Id,
                booking.Code,
                slot.Id,
                request.UserId);

            return Results.Created($"/bookings/{booking.Id}", ToResponse(booking));
        })
        .AddEndpointFilter<ValidationFilter<CreateBookingRequest>>()
        .WithName("CreateBooking");

        app.MapDelete("/bookings/{id:guid}", async (Guid id, BookingEngineDbContext db, ILogger<Program> logger) =>
        {
            var booking = await db.Bookings
                .Include(b => b.AvailabilitySlot)
                .FirstOrDefaultAsync(b => b.Id == id);

            if (booking is null)
            {
                return Results.NotFound();
            }

            if (booking.Status == BookingStatus.Cancelled)
            {
                return Results.NoContent();
            }

            booking.Status = BookingStatus.Cancelled;
            booking.AvailabilitySlot.CapacityRemaining += booking.Seats;

            try
            {
                await db.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                logger.LogWarning("Concurrency conflict cancelling booking {BookingId}", booking.Id);
                return Results.Conflict(new { message = "The slot changed while cancelling. Try again." });
            }

            logger.LogInformation(
                "Booking {BookingId} cancelled, slot {SlotId} capacity restored by {Seats}",
                booking.Id,
                booking.AvailabilitySlotId,
                booking.Seats);

            return Results.NoContent();
        })
        .WithName("CancelBooking");
    }

    private static async Task<string> GenerateUniqueCodeAsync(BookingEngineDbContext db, string resourceName)
    {
        for (var attempt = 0; attempt < 10; attempt++)
        {
            var candidate = BookingCode.Generate(resourceName, Random.Shared);
            if (!await db.Bookings.AnyAsync(b => b.Code == candidate))
            {
                return candidate;
            }
        }

        // Astronomically unlikely with a per-resource prefix + 4 digits; fall
        // back to a guaranteed-unique suffix rather than loop forever.
        return $"{BookingCode.Prefix(resourceName)}-{Guid.NewGuid():N}"[..12];
    }

    private static bool IsUniqueConstraintViolation(DbUpdateException ex) =>
        ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation };

    private static BookingResponse ToResponse(Booking booking) => new(
        booking.Id,
        booking.AvailabilitySlotId,
        booking.UserId,
        booking.Seats,
        booking.Status.ToString(),
        booking.Code,
        booking.IdempotencyKey,
        booking.CreatedAt);
}
