using BookingEngine.Api.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace BookingEngine.Api.Infrastructure.Seed;

public record SeedResult(int ResourceTypes, int Locations, int Resources, int AvailabilitySlots);

/// <summary>
/// Generates demo data for the "biblioteca" vertical from docs/design-handoff.md
/// so the frontend has real data to render against. Dev-only — see how this is
/// wired in Program.cs (only mapped when ASPNETCORE_ENVIRONMENT == Development).
///
/// Slot times are relative to the moment the seed runs, not fixed dates — every
/// call clears existing seed data first and regenerates, so picking the project
/// back up hours (or days) later always yields fresh "ahora mismo" data instead
/// of slots that quietly aged into the past.
/// </summary>
public static class DevSeeder
{
    public static async Task<SeedResult> SeedAsync(
        BookingEngineDbContext db,
        ILogger logger,
        CancellationToken cancellationToken = default)
    {
        // Dependency order matters: Booking/WaitlistEntry reference
        // AvailabilitySlot with DeleteBehavior.Restrict, so they have to go
        // first or the slot deletes below would be blocked.
        var deletedBookings = await db.Bookings.ExecuteDeleteAsync(cancellationToken);
        var deletedWaitlist = await db.WaitlistEntries.ExecuteDeleteAsync(cancellationToken);
        var deletedSlots = await db.AvailabilitySlots.ExecuteDeleteAsync(cancellationToken);
        var deletedResources = await db.Resources.ExecuteDeleteAsync(cancellationToken);
        var deletedLocations = await db.Locations.ExecuteDeleteAsync(cancellationToken);
        var deletedTypes = await db.ResourceTypes.ExecuteDeleteAsync(cancellationToken);

        logger.LogInformation(
            "Dev seed: cleared {Bookings} bookings, {Waitlist} waitlist entries, {Slots} slots, " +
            "{Resources} resources, {Locations} locations, {Types} resource types before reseeding",
            deletedBookings,
            deletedWaitlist,
            deletedSlots,
            deletedResources,
            deletedLocations,
            deletedTypes);

        var studyRoomType = new ResourceType
        {
            Id = Guid.NewGuid(),
            Name = "Sala de estudio",
            Labels = new ResourceLabels
            {
                Singular = "sala",
                Plural = "salas",
                CapacityUnit = "personas",
                ActionVerb = "Apartar",
            },
            AllowsMultipleSeats = true,
            AllowsWaitlist = true,
        };

        var soloSpaceType = new ResourceType
        {
            Id = Guid.NewGuid(),
            Name = "Espacio individual",
            Labels = new ResourceLabels
            {
                Singular = "espacio",
                Plural = "espacios",
                CapacityUnit = "persona",
                ActionVerb = "Apartar",
            },
            AllowsMultipleSeats = false,
            AllowsWaitlist = true,
        };

        var location = new Location
        {
            Id = Guid.NewGuid(),
            Name = "Biblioteca Central",
            Address = "Circuito Escolar s/n, Ciudad Universitaria",
            TimeZone = "America/Mexico_City",
        };

        var resources = new List<Resource>
        {
            new()
            {
                Id = Guid.NewGuid(),
                ResourceType = studyRoomType,
                Location = location,
                Name = "Sala Boreal 204",
                Capacity = 8,
                Description = "Piso 2 · pizarrón y pantalla",
            },
            new()
            {
                Id = Guid.NewGuid(),
                ResourceType = studyRoomType,
                Location = location,
                Name = "Sala Austral 118",
                Capacity = 6,
                Description = "Piso 1",
            },
            new()
            {
                Id = Guid.NewGuid(),
                ResourceType = studyRoomType,
                Location = location,
                Name = "Sala Meridiano 301",
                Capacity = 10,
                Description = "Piso 3 · pizarrón",
            },
            new()
            {
                Id = Guid.NewGuid(),
                ResourceType = soloSpaceType,
                Location = location,
                Name = "Escritorio flex 12B",
                Capacity = 1,
                Description = "Piso 2",
            },
            new()
            {
                Id = Guid.NewGuid(),
                ResourceType = soloSpaceType,
                Location = location,
                Name = "Cabina de audio 3",
                Capacity = 1,
                Description = "Piso 1",
            },
            new()
            {
                Id = Guid.NewGuid(),
                ResourceType = soloSpaceType,
                Location = location,
                Name = "Escritorio flex 8A",
                Capacity = 1,
                Description = "Piso 1",
            },
        };

        var slots = GenerateSlots(resources, location.TimeZone);

        db.ResourceTypes.AddRange(studyRoomType, soloSpaceType);
        db.Locations.Add(location);
        db.Resources.AddRange(resources);
        db.AvailabilitySlots.AddRange(slots);

        await db.SaveChangesAsync(cancellationToken);

        logger.LogInformation(
            "Dev seed: created {Types} resource types, {Locations} locations, {Resources} resources, " +
            "{Slots} availability slots",
            2,
            1,
            resources.Count,
            slots.Count);

        return new SeedResult(2, 1, resources.Count, slots.Count);
    }

    private static List<AvailabilitySlot> GenerateSlots(IReadOnlyList<Resource> resources, string timeZoneId)
    {
        var slotDuration = TimeSpan.FromMinutes(90);
        var dailyStartHour = 8;
        var slotsPerDay = 8; // 08:00 -> 20:00 LOCAL time, in 90-minute blocks
        var now = DateTimeOffset.UtcNow;
        var random = new Random(); // no fixed seed — every run should look fresh relative to "now"

        // Business hours are local to the location, not raw UTC clock hours —
        // seeding "08:00-20:00 UTC" directly meant the library effectively
        // opened 2am-2pm in Mexico City, closed by early afternoon local time.
        var timeZone = TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);
        var todayLocal = TimeZoneInfo.ConvertTimeFromUtc(now.UtcDateTime, timeZone).Date;

        var slots = new List<AvailabilitySlot>();

        foreach (var resource in resources)
        {
            var slotIndex = 0;

            // One slot starting 15-60 minutes from now, regardless of where
            // that falls relative to the fixed daily grid below — this is
            // what actually guarantees "Libre ahora mismo" has something the
            // moment the seed finishes, instead of depending on how close
            // `now` happens to land to a grid boundary.
            var nearTermStart = now + TimeSpan.FromMinutes(random.Next(15, 61));
            slots.Add(new AvailabilitySlot
            {
                Id = Guid.NewGuid(),
                Resource = resource,
                StartsAt = nearTermStart,
                EndsAt = nearTermStart + slotDuration,
                // Always bookable — the whole point of this slot is to have
                // something visible right away, not to land on the 0/1 demo pattern.
                CapacityRemaining = random.Next(1, resource.Capacity + 1),
            });
            slotIndex++;

            for (var dayOffset = 0; dayOffset < 3; dayOffset++)
            {
                var dayStartLocal = todayLocal.AddDays(dayOffset).AddHours(dailyStartHour);
                var dayStart = new DateTimeOffset(
                    TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(dayStartLocal, DateTimeKind.Unspecified), timeZone),
                    TimeSpan.Zero);

                for (var block = 0; block < slotsPerDay; block++)
                {
                    var startsAt = dayStart + (slotDuration * block);
                    if (startsAt < now)
                    {
                        continue; // don't generate slots already in the past today
                    }

                    var capacityRemaining = NextCapacityRemaining(resource.Capacity, slotIndex, random);

                    slots.Add(new AvailabilitySlot
                    {
                        Id = Guid.NewGuid(),
                        Resource = resource,
                        StartsAt = startsAt,
                        EndsAt = startsAt + slotDuration,
                        CapacityRemaining = capacityRemaining,
                    });

                    slotIndex++;
                }
            }
        }

        return slots;
    }

    /// <summary>
    /// Every 5th slot is forced fully booked (0) and every 7th down to the
    /// last spot (1), so both the "lleno" and "último lugar" UI states have
    /// real data to render against — everything else is randomized.
    /// </summary>
    private static int NextCapacityRemaining(int capacity, int slotIndex, Random random)
    {
        if (slotIndex % 5 == 0)
        {
            return 0;
        }

        if (slotIndex % 7 == 0)
        {
            return Math.Min(1, capacity);
        }

        return random.Next(0, capacity + 1);
    }
}
