using BookingEngine.Domain;
using BookingEngine.Infrastructure;

namespace BookingEngine.Api.Tests;

/// <summary>Minimal, isolated domain data for a single test — every call uses fresh Guids.</summary>
public static class TestData
{
    public static async Task<AvailabilitySlot> CreateSlotAsync(
        BookingEngineDbContext db,
        int capacityRemaining,
        DateTimeOffset? startsAt = null,
        bool allowsWaitlist = true)
    {
        var resourceType = new ResourceType
        {
            Id = Guid.NewGuid(),
            Name = $"Test type {Guid.NewGuid():N}",
            Labels = new ResourceLabels
            {
                Singular = "sala",
                Plural = "salas",
                CapacityUnit = "personas",
                ActionVerb = "Apartar",
            },
            AllowsMultipleSeats = true,
            AllowsWaitlist = allowsWaitlist,
        };

        var location = new Location
        {
            Id = Guid.NewGuid(),
            Name = $"Test location {Guid.NewGuid():N}",
            TimeZone = "America/Mexico_City",
        };

        var resource = new Resource
        {
            Id = Guid.NewGuid(),
            ResourceType = resourceType,
            Location = location,
            Name = $"Test resource {Guid.NewGuid():N}",
            Capacity = Math.Max(capacityRemaining, 1),
        };

        var start = startsAt ?? DateTimeOffset.UtcNow.AddHours(1);

        var slot = new AvailabilitySlot
        {
            Id = Guid.NewGuid(),
            Resource = resource,
            StartsAt = start,
            EndsAt = start.AddMinutes(90),
            CapacityRemaining = capacityRemaining,
        };

        db.AvailabilitySlots.Add(slot);
        await db.SaveChangesAsync();

        return slot;
    }

    /// <summary>A resource type row (multi-seat by default). For owner/schedule tests.</summary>
    public static async Task<ResourceType> CreateResourceTypeAsync(
        BookingEngineDbContext db, bool allowsMultipleSeats = true)
    {
        var type = new ResourceType
        {
            Id = Guid.NewGuid(),
            Name = $"Test type {Guid.NewGuid():N}",
            Labels = new ResourceLabels
            {
                Singular = "espacio",
                Plural = "espacios",
                CapacityUnit = allowsMultipleSeats ? "personas" : "persona",
                ActionVerb = "Apartar",
            },
            AllowsMultipleSeats = allowsMultipleSeats,
            AllowsWaitlist = true,
        };
        db.ResourceTypes.Add(type);
        await db.SaveChangesAsync();
        return type;
    }

    /// <summary>A resource owned by <paramref name="ownerUserId"/>, with its own location.</summary>
    public static async Task<Resource> CreateOwnedResourceAsync(
        BookingEngineDbContext db, string ownerUserId, ResourceType type, int capacity = 8)
    {
        var location = new Location
        {
            Id = Guid.NewGuid(),
            Name = $"Owned location {Guid.NewGuid():N}",
            TimeZone = "America/Mexico_City",
            OwnerUserId = ownerUserId,
        };
        var resource = new Resource
        {
            Id = Guid.NewGuid(),
            ResourceType = type,
            Location = location,
            Name = $"Owned resource {Guid.NewGuid():N}",
            Capacity = capacity,
            OwnerUserId = ownerUserId,
        };
        db.Resources.Add(resource);
        await db.SaveChangesAsync();
        return resource;
    }

    /// <summary>Adds another slot to an existing slot's resource — for testing "same resource" alternatives.</summary>
    public static async Task<AvailabilitySlot> AddSlotToResourceAsync(
        BookingEngineDbContext db,
        Guid resourceId,
        int capacityRemaining,
        DateTimeOffset startsAt)
    {
        var slot = new AvailabilitySlot
        {
            Id = Guid.NewGuid(),
            ResourceId = resourceId,
            StartsAt = startsAt,
            EndsAt = startsAt.AddMinutes(90),
            CapacityRemaining = capacityRemaining,
        };

        db.AvailabilitySlots.Add(slot);
        await db.SaveChangesAsync();

        return slot;
    }
}
