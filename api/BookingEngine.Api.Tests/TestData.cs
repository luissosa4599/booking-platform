using BookingEngine.Api.Domain;
using BookingEngine.Api.Infrastructure;

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
}
