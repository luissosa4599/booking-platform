using BookingEngine.Api.Application.Auth;
using BookingEngine.Domain;
using BookingEngine.Infrastructure;
using BookingEngine.Infrastructure.Availability;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace BookingEngine.Api.Infrastructure.Seed;

public record SeedResult(int ResourceTypes, int Locations, int Resources, int AvailabilitySlots);

/// <summary>
/// Generates demo data for a campus-booking vertical (UNAM + IPN) so the
/// frontend has real, varied data to render against. Dev-only — see how this is
/// wired in Program.cs (only mapped when ASPNETCORE_ENVIRONMENT == Development).
///
/// One resource per campus, cycling four <see cref="ResourceType"/>s:
///   - Auditorio / Salon    -> whole-unit booking (Capacity 1, no seat stepper):
///     "libre -> reservalo, ocupado -> ya esta tomado".
///   - Sala de lectura / Cubiculo -> per-seat booking (Capacity > 1, stepper).
///
/// Slot times are relative to the moment the seed runs, not fixed dates — every
/// call clears existing seed data first and regenerates, so picking the project
/// back up hours (or days) later always yields fresh "ahora mismo" data.
/// </summary>
public static class DevSeeder
{
    // Every campus below is UTC-6 year round (Mexico dropped DST in 2022), so a
    // single IANA zone drives slot generation for all of them.
    private const string CampusTimeZone = "America/Mexico_City";

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
        await db.ResourceImages.ExecuteDeleteAsync(cancellationToken);
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

        var auditorioType = new ResourceType
        {
            Id = Guid.NewGuid(),
            Name = "Auditorio",
            Labels = new ResourceLabels
            {
                Singular = "auditorio",
                Plural = "auditorios",
                CapacityUnit = "lugar",
                ActionVerb = "Reservar",
            },
            AllowsMultipleSeats = false,
            AllowsWaitlist = true,
        };

        var salonType = new ResourceType
        {
            Id = Guid.NewGuid(),
            Name = "Salon",
            Labels = new ResourceLabels
            {
                Singular = "salón",
                Plural = "salones",
                CapacityUnit = "lugar",
                ActionVerb = "Reservar",
            },
            AllowsMultipleSeats = false,
            AllowsWaitlist = true,
        };

        var salaLecturaType = new ResourceType
        {
            Id = Guid.NewGuid(),
            Name = "Sala de lectura",
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

        var cubiculoType = new ResourceType
        {
            Id = Guid.NewGuid(),
            Name = "Cubiculo de estudio",
            Labels = new ResourceLabels
            {
                Singular = "cubículo",
                Plural = "cubículos",
                CapacityUnit = "personas",
                ActionVerb = "Apartar",
            },
            AllowsMultipleSeats = true,
            AllowsWaitlist = true,
        };

        // The rotation order across campuses. Index i -> Cycle[i % 4].
        var cycle = new[] { auditorioType, salonType, salaLecturaType, cubiculoType };

        var now = DateTimeOffset.UtcNow;
        var locations = new List<Location>();
        var resources = new List<Resource>();
        var images = new List<ResourceImage>();

        for (var i = 0; i < Campuses.Length; i++)
        {
            var campus = Campuses[i];
            var type = cycle[i % cycle.Length];

            var location = new Location
            {
                Id = Guid.NewGuid(),
                Name = campus.Name,
                Address = campus.Address,
                TimeZone = CampusTimeZone,
                Latitude = campus.Lat,
                Longitude = campus.Lng,
            };

            var resource = new Resource
            {
                Id = Guid.NewGuid(),
                ResourceType = type,
                Location = location,
                Name = ResourceName(type, i),
                Capacity = CapacityFor(type),
                Description = DescriptionFor(type),
            };

            // Two photos from this type's pool, rotated by index so different
            // campuses of the same type don't all lead with the same picture.
            var pool = PhotoPool(type);
            for (var p = 0; p < 2; p++)
            {
                images.Add(new ResourceImage
                {
                    Id = Guid.NewGuid(),
                    ResourceId = resource.Id,
                    Url = pool[(i + p) % pool.Length],
                    Position = p,
                    CreatedAt = now,
                });
            }

            locations.Add(location);
            resources.Add(resource);
        }

        var slots = GenerateSlots(resources, CampusTimeZone);

        db.ResourceTypes.AddRange(cycle);
        db.Locations.AddRange(locations);
        db.Resources.AddRange(resources);
        db.AvailabilitySlots.AddRange(slots);
        db.ResourceImages.AddRange(images);

        await db.SaveChangesAsync(cancellationToken);

        var hostSlots = await SeedHostAsync(db, salaLecturaType, cancellationToken);

        logger.LogInformation(
            "Dev seed: created {Types} resource types, {Locations} locations, {Resources} resources, " +
            "{Images} photos, {Slots} availability slots (incl. {HostSlots} for the demo host)",
            cycle.Length,
            locations.Count + 1,
            resources.Count + 2,
            images.Count,
            slots.Count + hostSlots,
            hostSlots);

        return new SeedResult(
            cycle.Length,
            locations.Count + 1,
            resources.Count + 2,
            slots.Count + hostSlots);
    }

    private static int CapacityFor(ResourceType type) => type.Name switch
    {
        "Sala de lectura" => 48,
        "Cubiculo de estudio" => 6,
        _ => 1, // Auditorio / Salon — booked as a whole unit.
    };

    private static string DescriptionFor(ResourceType type) => type.Name switch
    {
        "Auditorio" => "Escenario, proyector y audio · ~200 asistentes · resérvalo completo",
        "Salon" => "Aula con pizarrón y proyector · ~35 lugares · para tu clase o grupo",
        "Sala de lectura" => "48 lugares · silencio, wifi y enchufes en cada mesa",
        "Cubiculo de estudio" => "Para grupos chicos · pizarrón portátil · hasta 6 personas",
        _ => string.Empty,
    };

    // A few real, well-known names; generic-but-plausible for the rest, varied
    // by the campus index so a screen of many auditorios doesn't read as a
    // copy-paste.
    private static string ResourceName(ResourceType type, int campusIndex) => type.Name switch
    {
        "Auditorio" => campusIndex switch
        {
            7 => "Auditorio Javier Barros Sierra",   // Facultad de Ingenieria, UNAM
            4 => "Auditorio Eduardo Garcia Maynez",  // Facultad de Derecho, UNAM
            _ => $"Auditorio {AuditorioSuffix(campusIndex)}",
        },
        "Salon" => $"Salón {100 + (campusIndex % 6) * 10 + (campusIndex % 4) + 1}",
        "Sala de lectura" => (campusIndex % 3) switch
        {
            0 => "Sala de lectura — Planta alta",
            1 => "Sala de lectura Norte",
            _ => "Sala de lectura central",
        },
        _ => $"Cubículo de estudio {1 + (campusIndex % 9)}",
    };

    private static string AuditorioSuffix(int i)
    {
        var letters = new[] { "A", "B", "C", "Principal", "II" };
        return letters[(i / 4) % letters.Length];
    }

    private static readonly string[] AuditorioPhotos =
    {
        Photo("1519452575417-564c1401ecc0"),
        Photo("1540575467063-178a50c2df87"),
        Photo("1505373877841-8d25f7d46678"),
    };

    private static readonly string[] SalonPhotos =
    {
        Photo("1580582932707-520aed937b7b"),
        Photo("1509062522246-3755977927d7"),
        Photo("1524178232363-1fb2b075b655"),
    };

    private static readonly string[] SalaLecturaPhotos =
    {
        Photo("1568667256549-094345857637"),
        Photo("1498243691581-b145c3f54a5a"),
        Photo("1481627834876-b7833e8f5570"),
    };

    private static readonly string[] CubiculoPhotos =
    {
        Photo("1434030216411-0b793f4b4173"),
        Photo("1531482615713-2afd69097998"),
        Photo("1587560699334-cc4ff634909a"),
    };

    private static string[] PhotoPool(ResourceType type) => type.Name switch
    {
        "Auditorio" => AuditorioPhotos,
        "Salon" => SalonPhotos,
        "Sala de lectura" => SalaLecturaPhotos,
        _ => CubiculoPhotos,
    };

    // Unsplash's image CDN (Unsplash License — no key, no attribution). The
    // "photo-<id>" form with query params is stable per photo id; every id here
    // was verified 200 + subject-checked. Not photos of the real campus —
    // stand-ins until real photography exists (same story as lib/stockImages.ts).
    private static string Photo(string id) =>
        $"https://images.unsplash.com/photo-{id}?auto=format&fit=crop&w=1200&q=70";

    private sealed record Campus(string Name, string Address, double Lat, double Lng);

    // ~50 real UNAM + IPN campuses. Coordinates are campus-level approximate
    // (right place, not necessarily the exact building).
    private static readonly Campus[] Campuses =
    {
        // --- UNAM · Ciudad Universitaria (CDMX) ---
        new("Facultad de Arquitectura, UNAM", "Ciudad Universitaria, Coyoacán, CDMX", 19.3323, -99.1898),
        new("Facultad de Ciencias, UNAM", "Ciudad Universitaria, Coyoacán, CDMX", 19.3229, -99.1780),
        new("Facultad de Ciencias Políticas y Sociales, UNAM", "Ciudad Universitaria, Coyoacán, CDMX", 19.3330, -99.1852),
        new("Facultad de Contaduría y Administración, UNAM", "Ciudad Universitaria, Coyoacán, CDMX", 19.3655, -99.1798),
        new("Facultad de Derecho, UNAM", "Ciudad Universitaria, Coyoacán, CDMX", 19.3321, -99.1873),
        new("Facultad de Economía, UNAM", "Ciudad Universitaria, Coyoacán, CDMX", 19.3337, -99.1878),
        new("Facultad de Filosofía y Letras, UNAM", "Ciudad Universitaria, Coyoacán, CDMX", 19.3324, -99.1861),
        new("Facultad de Ingeniería, UNAM", "Ciudad Universitaria, Coyoacán, CDMX", 19.3296, -99.1811),
        new("Facultad de Medicina, UNAM", "Ciudad Universitaria, Coyoacán, CDMX", 19.3213, -99.1835),
        new("Facultad de Medicina Veterinaria y Zootecnia, UNAM", "Ciudad Universitaria, Coyoacán, CDMX", 19.3175, -99.1768),
        new("Facultad de Psicología, UNAM", "Ciudad Universitaria, Coyoacán, CDMX", 19.3306, -99.1792),
        new("Facultad de Química, UNAM", "Ciudad Universitaria, Coyoacán, CDMX", 19.3268, -99.1793),
        new("Escuela Nacional de Trabajo Social, UNAM", "Ciudad Universitaria, Coyoacán, CDMX", 19.3239, -99.1866),
        new("Escuela Nacional de Lenguas, Lingüística y Traducción, UNAM", "Ciudad Universitaria, Coyoacán, CDMX", 19.3300, -99.1832),
        new("Escuela Nacional de Artes Cinematográficas, UNAM", "Ciudad Universitaria, Coyoacán, CDMX", 19.3193, -99.1809),

        // --- UNAM · CDMX (fuera de CU) ---
        new("Facultad de Música, UNAM", "Coyoacán, CDMX", 19.3540, -99.1622),
        new("Facultad de Artes y Diseño, UNAM", "Xochimilco, CDMX", 19.2857, -99.1050),
        new("Escuela Nacional de Enfermería y Obstetricia, UNAM", "Tlalpan, CDMX", 19.2957, -99.1560),

        // --- UNAM · FES ---
        new("FES Zaragoza, UNAM", "Iztapalapa, CDMX", 19.3672, -99.0700),
        new("FES Iztacala, UNAM", "Tlalnepantla de Baz, Estado de México", 19.5490, -99.1972),
        new("FES Acatlán, UNAM", "Naucalpan de Juárez, Estado de México", 19.4826, -99.2437),
        new("FES Cuautitlán, UNAM", "Cuautitlán Izcalli, Estado de México", 19.6866, -99.1961),
        new("FES Aragón, UNAM", "Nezahualcóyotl, Estado de México", 19.4727, -99.0480),

        // --- UNAM · ENES ---
        new("ENES Juriquilla, UNAM", "Juriquilla, Querétaro", 20.7027, -100.4470),
        new("ENES León, UNAM", "León, Guanajuato", 21.1497, -101.6432),
        new("ENES Morelia, UNAM", "Morelia, Michoacán", 19.6470, -101.2270),
        new("ENES Mérida, UNAM", "Mérida, Yucatán", 21.0250, -89.6430),
        new("ENES Oaxaca, UNAM", "San Pablo Etla, Oaxaca", 17.0870, -96.7180),

        // --- IPN · Unidad Profesional Adolfo López Mateos (Zacatenco, CDMX) ---
        new("ESIME Unidad Zacatenco, IPN", "Zacatenco, Gustavo A. Madero, CDMX", 19.5046, -99.1307),
        new("ESIA Unidad Zacatenco, IPN", "Zacatenco, Gustavo A. Madero, CDMX", 19.5077, -99.1360),
        new("Escuela Superior de Física y Matemáticas, IPN", "Zacatenco, Gustavo A. Madero, CDMX", 19.5028, -99.1291),
        new("Escuela Superior de Cómputo (ESCOM), IPN", "Zacatenco, Gustavo A. Madero, CDMX", 19.5041, -99.1266),
        new("ESIQIE, IPN", "Zacatenco, Gustavo A. Madero, CDMX", 19.5060, -99.1332),
        new("Escuela Superior de Ingeniería Textil, IPN", "Zacatenco, Gustavo A. Madero, CDMX", 19.5066, -99.1348),
        new("Escuela Superior de Economía, IPN", "Zacatenco, Gustavo A. Madero, CDMX", 19.5054, -99.1360),
        new("Escuela Superior de Turismo, IPN", "Zacatenco, Gustavo A. Madero, CDMX", 19.5093, -99.1289),
        new("Escuela Nacional de Ciencias Biológicas — Zacatenco, IPN", "Zacatenco, Gustavo A. Madero, CDMX", 19.5017, -99.1301),

        // --- IPN · Casco de Santo Tomás (CDMX) ---
        new("ESCA Unidad Santo Tomás, IPN", "Casco de Santo Tomás, Miguel Hidalgo, CDMX", 19.4585, -99.1596),
        new("Escuela Nacional de Ciencias Biológicas — Casco, IPN", "Casco de Santo Tomás, Miguel Hidalgo, CDMX", 19.4573, -99.1533),
        new("Escuela Superior de Medicina, IPN", "Casco de Santo Tomás, Miguel Hidalgo, CDMX", 19.4561, -99.1491),
        new("CICS Unidad Santo Tomás, IPN", "Casco de Santo Tomás, Miguel Hidalgo, CDMX", 19.4600, -99.1560),
        new("Escuela Superior de Enfermería y Obstetricia, IPN", "Casco de Santo Tomás, Miguel Hidalgo, CDMX", 19.4571, -99.1502),

        // --- IPN · otras unidades (zona metropolitana) ---
        new("ESIME Unidad Culhuacán, IPN", "Coyoacán, CDMX", 19.3346, -99.1031),
        new("ESIME Unidad Azcapotzalco, IPN", "Azcapotzalco, CDMX", 19.5020, -99.1868),
        new("ESIME Unidad Ticomán, IPN", "Gustavo A. Madero, CDMX", 19.5136, -99.1310),
        new("ESIA Unidad Ticomán, IPN", "Gustavo A. Madero, CDMX", 19.5150, -99.1289),
        new("ESIA Unidad Tecamachalco, IPN", "Naucalpan de Juárez, Estado de México", 19.4268, -99.2470),
        new("UPIICSA, IPN", "Iztacalco, CDMX", 19.3958, -99.0902),
        new("UPIITA, IPN", "Gustavo A. Madero, CDMX", 19.5115, -99.1300),
        new("UPIBI, IPN", "Gustavo A. Madero, CDMX", 19.5128, -99.1289),
        new("Escuela Nacional de Medicina y Homeopatía, IPN", "Gustavo A. Madero, CDMX", 19.4872, -99.1170),
        new("ESCA Unidad Tepepan, IPN", "Tlalpan, CDMX", 19.2872, -99.1372),
        new("CICS Unidad Milpa Alta, IPN", "Milpa Alta, CDMX", 19.1922, -99.0232),
        new("Escuela Nacional de Biblioteconomía y Archivonomía, IPN", "Gustavo A. Madero, CDMX", 19.4880, -99.1290),

        // --- IPN · unidades foráneas (UPII) ---
        new("UPIIG — Campus Guanajuato, IPN", "Silao de la Victoria, Guanajuato", 20.9470, -101.4270),
        new("UPIIZ — Campus Zacatecas, IPN", "Zacatecas, Zacatecas", 22.7690, -102.5760),
        new("UPIIH — Campus Hidalgo, IPN", "San Agustín Tlaxiaca, Hidalgo", 20.0888, -98.7620),
        new("UPIIP — Campus Palenque, IPN", "Palenque, Chiapas", 17.5090, -91.9820),
        new("UPIIC — Campus Coahuila, IPN", "Ramos Arizpe, Coahuila", 25.4230, -101.0010),
        new("UPIIT — Campus Tlaxcala, IPN", "Tlaxcala de Xicohténcatl, Tlaxcala", 19.3160, -98.2380),
    };

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
            Address = "Av. Reforma 222, Juárez, CDMX",
            Latitude = 19.4270,
            Longitude = -99.1677,
            TimeZone = CampusTimeZone,
            OwnerUserId = hostId,
        };
        var salaGrande = new Resource
        {
            Id = Guid.NewGuid(),
            ResourceType = type,
            Location = location,
            Name = "Sala grande",
            Capacity = 10,
            Description = "Piso 4 · pizarrón y pantalla",
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
        var slotsPerDay = 6; // 08:00 -> 17:00 LOCAL time, in 90-minute blocks
        var daysAhead = 2;   // today + tomorrow — with ~60 resources this keeps
                             // GET /availability from returning thousands of slots
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

            // One slot that's ALREADY in progress — started a little while ago,
            // still running for most of an hour. This is what guarantees
            // "Libre ahora mismo" always has something, at any time of day: a
            // future-starting slot falls outside Explore's default "hasta el
            // fin de hoy" window when the seed runs late in the evening (and
            // the fixed daily grid below is already spent), leaving the screen
            // on its empty state. An in-progress slot satisfies both the API's
            // `EndsAt >= from` filter and the client's "starts within the hour"
            // grouping no matter the clock.
            var inProgressStart = now - TimeSpan.FromMinutes(random.Next(10, 45));
            slots.Add(new AvailabilitySlot
            {
                Id = Guid.NewGuid(),
                Resource = resource,
                StartsAt = inProgressStart,
                EndsAt = inProgressStart + slotDuration,
                // Always bookable — the whole point of this slot is to have
                // something visible right away.
                CapacityRemaining = random.Next(1, resource.Capacity + 1),
            });
            slotIndex++;

            for (var dayOffset = 0; dayOffset < daysAhead; dayOffset++)
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
    /// real data to render against — everything else is randomized. For a
    /// whole-unit resource (Capacity 1) this just alternates libre / ocupado.
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
