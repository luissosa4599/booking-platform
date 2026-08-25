using System.Net.Http.Json;
using BookingEngine.Api.Application.Availability;
using BookingEngine.Api.Domain;
using BookingEngine.Api.Infrastructure;
using Microsoft.Extensions.DependencyInjection;

namespace BookingEngine.Api.Tests;

[Collection("Api")]
public class AvailabilityFilteringTests(ApiTestFixture fixture)
{
    [Fact]
    public async Task GetAvailability_FiltersByDateRange()
    {
        using var setupScope = fixture.Factory.Services.CreateScope();
        var db = setupScope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();

        var now = DateTimeOffset.UtcNow;

        var inRangeSlot = await TestData.CreateSlotAsync(db, capacityRemaining: 3, startsAt: now.AddDays(1));
        var resourceTypeId = inRangeSlot.Resource.ResourceTypeId;

        // Same resource type, but outside the queried window on either side.
        var beforeRangeSlot = await CreateSlotForSameTypeAsync(db, resourceTypeId, now.AddDays(-5));
        var afterRangeSlot = await CreateSlotForSameTypeAsync(db, resourceTypeId, now.AddDays(10));

        var client = fixture.Factory.CreateClient();
        var from = now.AddHours(12).ToString("O");
        var to = now.AddDays(2).ToString("O");

        var response = await client.GetAsync(
            $"/availability?resourceTypeId={resourceTypeId}&from={Uri.EscapeDataString(from)}&to={Uri.EscapeDataString(to)}");

        response.EnsureSuccessStatusCode();
        var slots = await response.Content.ReadFromJsonAsync<List<AvailabilitySlotResponse>>();

        Assert.NotNull(slots);
        Assert.Contains(slots, s => s.Id == inRangeSlot.Id);
        Assert.DoesNotContain(slots, s => s.Id == beforeRangeSlot.Id);
        Assert.DoesNotContain(slots, s => s.Id == afterRangeSlot.Id);
    }

    private static async Task<AvailabilitySlot> CreateSlotForSameTypeAsync(
        BookingEngineDbContext db,
        Guid resourceTypeId,
        DateTimeOffset startsAt)
    {
        var resourceType = await db.ResourceTypes.FindAsync(resourceTypeId)
            ?? throw new InvalidOperationException("Resource type not found.");

        var location = new Location
        {
            Id = Guid.NewGuid(),
            Name = $"Test location {Guid.NewGuid():N}",
            TimeZone = "America/Mexico_City",
        };

        var resource = new Resource
        {
            Id = Guid.NewGuid(),
            ResourceTypeId = resourceType.Id,
            Location = location,
            Name = $"Test resource {Guid.NewGuid():N}",
            Capacity = 4,
        };

        var slot = new AvailabilitySlot
        {
            Id = Guid.NewGuid(),
            Resource = resource,
            StartsAt = startsAt,
            EndsAt = startsAt.AddMinutes(90),
            CapacityRemaining = 4,
        };

        db.AvailabilitySlots.Add(slot);
        await db.SaveChangesAsync();

        return slot;
    }
}
