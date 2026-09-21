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

        // A per-*type* counter (0, 1, 2, ... within Auditorio, within Salon,
        // etc.) rather than the raw campus index — ResourceName below derives
        // room numbers/labels from this. Deriving them from the raw campus
        // index instead (the previous approach) meant two different modulo
        // operations landed on the same result every few campuses — e.g.
        // "Salón 112" and "Cubículo de estudio 6" each showing up at multiple,
        // unrelated real campuses, which is exactly what reads as "generated
        // test data" rather than a real directory of rooms.
        var typeOrdinal = new Dictionary<string, int>();

        for (var i = 0; i < Campuses.Length; i++)
        {
            var campus = Campuses[i];
            var type = cycle[i % cycle.Length];
            var ordinal = typeOrdinal.GetValueOrDefault(type.Name);
            typeOrdinal[type.Name] = ordinal + 1;

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
                Name = ResourceName(type, ordinal),
                Capacity = CapacityFor(type),
                Description = DescriptionFor(type),
            };

            // Two photos from this type's pool, rotated by the per-TYPE
            // ordinal (not the raw campus index `i`) so different campuses of
            // the same type don't all lead with the same picture. `i` cycles
            // through all 4 types with period `cycle.Length`, so every
            // resource of a given type shares the same `i % cycle.Length` —
            // rotating by `i` instead of `ordinal` collapses to one constant
            // pool offset whenever a pool's length shares a factor with
            // `cycle.Length` (2026-09-14 report: "los auditorios la foto es
            // igual para todos" — AuditorioPhotos was expanded to exactly 4,
            // matching cycle.Length, so `i` was ALWAYS ≡ 0 mod 4 for every
            // Auditorio). `ordinal` increments by exactly 1 per same-type
            // resource regardless of pool size or cycle length, so this stays
            // correct no matter how any pool is resized in the future.
            var pool = PhotoPool(type);
            for (var p = 0; p < 2; p++)
            {
                images.Add(new ResourceImage
                {
                    Id = Guid.NewGuid(),
                    ResourceId = resource.Id,
                    Url = pool[(ordinal + p) % pool.Length],
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
        "Sala de lectura" => "Silencio, wifi y enchufes en cada mesa",
        "Cubiculo de estudio" => "Para grupos chicos · pizarrón portátil",
        _ => string.Empty,
    };

    // A few real, well-known names; every other one is derived from `ordinal`
    // (this type's own 0, 1, 2, ... counter — see the caller) so no two
    // campuses of the same type ever end up with an identical resource name.
    private static string ResourceName(ResourceType type, int ordinal) => type.Name switch
    {
        // Ordinal 1 within Auditorio is campus index 4, Facultad de Derecho,
        // UNAM (see Campuses below) — its real auditorium name.
        "Auditorio" => ordinal switch
        {
            1 => "Auditorio Eduardo Garcia Maynez",
            _ => $"Auditorio {AuditorioSuffix(ordinal)}",
        },
        "Salon" => SalonName(ordinal),
        "Sala de lectura" => $"Sala de lectura {SalaLecturaSection(ordinal)}",
        _ => $"Cubículo de estudio {ordinal + 1}",
    };

    // "Edificio {letter}, Salón {floor}{room}" — every (building, floor) pair
    // is unique for the first 16 ordinals (4 buildings x 4 floors), so even
    // before the room number varies, no two Salon-type campuses can collide.
    private static string SalonName(int ordinal)
    {
        var building = (char)('A' + ordinal % 4);
        var floor = 1 + ordinal / 4 % 4;
        var room = 1 + ordinal * 3 % 8;
        return $"Edificio {building}, Salón {floor}{room:D2}";
    }

    // 15 entries — matches the 15 Sala de lectura resources seeded (60
    // campuses / 4 types), so every one gets a distinct name; modulo is a
    // safety net; not the expected path. Previously only 5 entries for 15
    // resources, so 3 *different* campuses always ended up with the
    // identical name (e.g. three unrelated "Sala de lectura Norte", each at
    // a different UNAM/IPN campus) — read as a duplicate-card bug even
    // though `resourceId`/location were genuinely different (2026-09-17
    // report, after the same-resource-multi-slot dedupe fix already
    // handled the *other* card-repeats-itself case).
    private static string SalaLecturaSection(int ordinal)
    {
        var sections = new[]
        {
            "— Planta alta", "Norte", "Central", "— Planta baja", "Sur",
            "Este", "Oeste", "— Ala norte", "— Ala sur", "II",
            "III", "— Anexo", "Poniente", "Oriente", "— Sala silenciosa",
        };
        return sections[ordinal % sections.Length];
    }

    // Same fix, same reasoning as `SalaLecturaSection` above — 15 entries
    // for the 15 seeded Auditorio resources (ordinal 1 is skipped here
    // since it's special-cased to a real named auditorium in
    // `ResourceName`, so one entry goes unused; still enough for the
    // remaining 14).
    private static string AuditorioSuffix(int ordinal)
    {
        var letters = new[]
        {
            "A", "B", "C", "D", "E", "Principal", "II", "Norte", "Sur", "Mayor",
            "Menor", "Central", "F", "G", "III",
        };
        return letters[ordinal % letters.Length];
    }

    // Pools expanded again 2026-09-17 (user: "puedes hacer que todas las
    // imagenes sean diferentes?") from 3-6 per type to >=15 per type — the
    // number of same-type resources seeded (60 campuses / 4 types), so the
    // *primary* photo (position 0, what Explore/Mapa actually show) is
    // guaranteed unique per resource of a given type; only the *secondary*
    // carousel-only photo can occasionally repeat one image with an adjacent
    // resource (see the rotation comment above). Every new id here was both
    // HTTP-verified (200) and visually subject-checked (downloaded +
    // reviewed) before being added, same bar as the originals — several
    // candidates were rejected during that pass for being off-theme (a
    // corporate boardroom with visible branding, two church/worship stages
    // that surfaced under "auditorium" searches, a classroom photo that
    // turned out to be a small seminar room, elementary-school homework/desk
    // shots for what's meant to be a university "cubiculo").
    private static readonly string[] AuditorioPhotos =
    {
        Photo("1519452575417-564c1401ecc0"),
        Photo("1540575467063-178a50c2df87"),
        Photo("1505373877841-8d25f7d46678"),
        Photo("1592280771190-3e2e4d571952"),
        Photo("1539010315750-8e1c7f16e415"),
        Photo("1576436978289-3bcb91a03710"),
        Photo("1545129139-1beb780cf337"),
        Photo("1631702825172-a9a848c473ad"),
        Photo("1722321974528-ec8eaf725777"),
        Photo("1722321974501-059dff03e970"),
        Photo("1760121788536-9797394e210e"),
        Photo("1778877035014-98c41b7c1460"),
        Photo("1770844102881-f8823e9f3c83"),
        Photo("1687773448285-50ee470e5583"),
        Photo("1727949224255-6c85dbd25138"),
        Photo("1733714654550-699d41c72b7d"),
    };

    private static readonly string[] SalonPhotos =
    {
        Photo("1580582932707-520aed937b7b"),
        Photo("1509062522246-3755977927d7"),
        Photo("1524178232363-1fb2b075b655"),
        Photo("1643386581833-6ca5e552255c"),
        Photo("1757193714669-875a0b0faf45"),
        Photo("1761449554823-e231e73b9caa"),
        Photo("1644997933069-f5ede7b207ac"),
        Photo("1727109369808-fbab005cca4b"),
        Photo("1757193714692-44cdf07a5377"),
        Photo("1740635341299-3b8e3490f546"),
        Photo("1576073459656-9b03ee75cc92"),
        Photo("1758270704522-f091f8064a81"),
        Photo("1758270704534-fd9715bffc0e"),
        Photo("1635424239131-32dc44986b56"),
        Photo("1643199135305-60d59f7ffd1b"),
    };

    private static readonly string[] SalaLecturaPhotos =
    {
        Photo("1568667256549-094345857637"),
        Photo("1498243691581-b145c3f54a5a"),
        Photo("1481627834876-b7833e8f5570"),
        Photo("1523240795612-9a054b0db644"),
        Photo("1524995997946-a1c2e315a42f"),
        Photo("1497633762265-9d179a990aa6"),
        Photo("1741707596672-4fcd53ec27bd"),
        Photo("1765394715568-889eab558ed2"),
        Photo("1567168544646-208fa5d408fb"),
        Photo("1588581939864-064d42ace7cd"),
        Photo("1741795746033-d50d48dc1da5"),
        Photo("1741795821996-a0369f5e825e"),
        Photo("1775229106888-dca42d0c9f4f"),
        Photo("1741795821804-451ccc87aec8"),
        Photo("1741699428220-65f37f3fbbcb"),
    };

    private static readonly string[] CubiculoPhotos =
    {
        Photo("1434030216411-0b793f4b4173"),
        Photo("1531482615713-2afd69097998"),
        Photo("1587560699334-cc4ff634909a"),
        Photo("1522202176988-66273c2fd55f"),
        Photo("1543269865-cbf427effbad"),
        Photo("1769794371055-54436b54577e"),
        Photo("1650661926447-9efb2610f64c"),
        Photo("1703854599747-4355f123dd3f"),
        Photo("1758640920659-0bb864175983"),
        Photo("1660722130895-21f0c850dc12"),
        Photo("1754697831323-6d51e460ba8f"),
        Photo("1756032433560-56547efed550"),
        Photo("1747515203898-2df8f083f417"),
        Photo("1547742992-51d6fbc9d236"),
        Photo("1711843250791-d81f5508364f"),
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
        // 60 days out (2026-09-21: was 2 — "today + tomorrow" — bumped so a
        // single seed run covers a full Play Store closed-testing period
        // without needing the daily reseed cron, which wipes ALL bookings
        // (including real testers') on every run. GET /availability response
        // size isn't affected by this — callers always scope by from/to, so
        // a narrow query still returns the same handful of rows regardless
        // of how far the table's data extends.
        var daysAhead = 60;
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
