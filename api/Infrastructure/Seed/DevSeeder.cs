using BookingEngine.Api.Application.Auth;
using BookingEngine.Domain;
using BookingEngine.Infrastructure;
using BookingEngine.Infrastructure.Availability;
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

        // Three campus locations with real-ish coordinates (Mexico City) so the
        // resource-detail map preview + "Cómo llegar" link actually vary per
        // resource — a single seeded location made that feature impossible to
        // demo. All share the same IANA time zone (slot generation assumes one).
        var bibliotecaCentral = new Location
        {
            Id = Guid.NewGuid(),
            Name = "Biblioteca Central",
            Address = "Circuito Escolar s/n, Ciudad Universitaria",
            TimeZone = "America/Mexico_City",
            Latitude = 19.4195,
            Longitude = -99.1810,
        };

        var vasconcelos = new Location
        {
            Id = Guid.NewGuid(),
            Name = "Biblioteca Vasconcelos",
            Address = "Eje 1 Norte s/n, Buenavista, Cuauhtemoc",
            TimeZone = "America/Mexico_City",
            Latitude = 19.4470,
            Longitude = -99.1523,
        };

        var centroCultural = new Location
        {
            Id = Guid.NewGuid(),
            Name = "Centro Cultural Universitario",
            Address = "Insurgentes Sur 3000, Ciudad Universitaria",
            TimeZone = "America/Mexico_City",
            Latitude = 19.3175,
            Longitude = -99.1856,
        };

        var locations = new List<Location> { bibliotecaCentral, vasconcelos, centroCultural };

        var resources = new List<Resource>
        {
            new()
            {
                Id = Guid.NewGuid(),
                ResourceType = studyRoomType,
                Location = bibliotecaCentral,
                Name = "Sala Boreal 204",
                Capacity = 8,
                Description = "Piso 2 · pizarrón y pantalla",
            },
            new()
            {
                Id = Guid.NewGuid(),
                ResourceType = studyRoomType,
                Location = bibliotecaCentral,
                Name = "Sala Austral 118",
                Capacity = 6,
                Description = "Piso 1",
            },
            new()
            {
                Id = Guid.NewGuid(),
                ResourceType = studyRoomType,
                Location = vasconcelos,
                Name = "Sala Meridiano 301",
                Capacity = 10,
                Description = "Piso 3 · pizarrón",
            },
            new()
            {
                Id = Guid.NewGuid(),
                ResourceType = soloSpaceType,
                Location = vasconcelos,
                Name = "Escritorio flex 12B",
                Capacity = 1,
                Description = "Piso 2",
            },
            new()
            {
                Id = Guid.NewGuid(),
                ResourceType = soloSpaceType,
                Location = centroCultural,
                Name = "Cabina de audio 3",
                Capacity = 1,
                Description = "Planta baja",
            },
            new()
            {
                Id = Guid.NewGuid(),
                ResourceType = soloSpaceType,
                Location = centroCultural,
                Name = "Escritorio flex 8A",
                Capacity = 1,
                Description = "Piso 1",
            },
        };

        var slots = GenerateSlots(resources, bibliotecaCentral.TimeZone);

        db.ResourceTypes.AddRange(studyRoomType, soloSpaceType);
        db.Locations.AddRange(locations);
        db.Resources.AddRange(resources);
        db.AvailabilitySlots.AddRange(slots);

        await db.SaveChangesAsync(cancellationToken);

        var hostSlots = await SeedHostAsync(db, studyRoomType, cancellationToken);

        logger.LogInformation(
            "Dev seed: created {Types} resource types, {Locations} locations, {Resources} resources, " +
            "{Slots} availability slots (incl. {HostSlots} for the demo host)",
            2,
            locations.Count + 1,
            resources.Count + 2,
            slots.Count + hostSlots,
            hostSlots);

        return new SeedResult(2, locations.Count + 1, resources.Count + 2, slots.Count + hostSlots);
    }

    // A ready-made host account so the (owner) flow has something to show
    // without publishing a space by hand. Sign in with host@tempo.demo (dev
    // magic link) — the account is already role=Host and owns "Piso creativo".
    private static async Task<int> SeedHostAsync(
        BookingEngineDbContext db,
        ResourceType type,
        CancellationToken ct)
    {
        const string email = "host@tempo.demo";
        var hostId = MagicLinkTokens.UserIdFor(email);
        var now = DateTimeOffset.UtcNow;

        var host = await db.Users.FirstOrDefaultAsync(u => u.Id == hostId, ct);
        if (host is null)
        {
            host = new User { Id = hostId, Email = email, DisplayName = "Anfitrion Demo", CreatedAt = now };
            db.Users.Add(host);
        }
        host.Role = AccountRole.Host;
        host.LastSeenAt = now;

        var location = new Location
        {
            Id = Guid.NewGuid(),
            Name = "Piso creativo",
            Address = "Av. Reforma 222, Juarez",
            TimeZone = "America/Mexico_City",
            OwnerUserId = hostId,
        };
        var salaGrande = new Resource
        {
            Id = Guid.NewGuid(),
            ResourceType = type,
            Location = location,
            Name = "Sala grande",
            Capacity = 10,
            Description = "Piso 4 - pizarron y pantalla",
            OwnerUserId = hostId,
        };
        var cabina = new Resource
        {
            Id = Guid.NewGuid(),
            ResourceType = type,
            Location = location,
            Name = "Cabina 2",
            Capacity = 4,
            Description = "Piso 4",
            OwnerUserId = hostId,
        };

        var schedule = new WeeklySchedule
        {
            Id = Guid.NewGuid(),
            Resource = salaGrande,
            SlotDurationMinutes = 90,
            Capacity = 8,
            UpdatedAt = now,
            Days = Enum.GetValues<DayOfWeek>()
                .Where(d => d is >= DayOfWeek.Monday and <= DayOfWeek.Friday)
                .Select(d => new WeeklyScheduleDay
                {
                    Id = Guid.NewGuid(),
                    Weekday = d,
                    OpenTime = new TimeOnly(9, 0),
                    CloseTime = new TimeOnly(19, 0),
                    Enabled = true,
                })
                .ToList(),
        };

        db.Locations.Add(location);
        db.Resources.AddRange(salaGrande, cabina);
        db.WeeklySchedules.Add(schedule);
        await db.SaveChangesAsync(ct);

        var generated = SlotWindowExpander.Expand(
            salaGrande.Id, location.TimeZone, schedule, [], now);
        db.AvailabilitySlots.AddRange(generated);
        await db.SaveChangesAsync(ct);

        return generated.Count;
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
