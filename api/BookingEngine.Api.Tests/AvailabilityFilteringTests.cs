using System.Net.Http.Json;
using BookingEngine.Api.Application.Availability;
using BookingEngine.Domain;
using BookingEngine.Infrastructure;
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
        var body = await response.Content.ReadFromJsonAsync<AvailabilityResponse>();

        Assert.NotNull(body);
        var slots = body.Slots;
        Assert.Contains(slots, s => s.Id == inRangeSlot.Id);
        Assert.DoesNotContain(slots, s => s.Id == beforeRangeSlot.Id);
        Assert.DoesNotContain(slots, s => s.Id == afterRangeSlot.Id);
        Assert.Null(body.EmptyContext);
    }

    [Fact]
    public async Task GetAvailability_EmptyResult_IncludesEmptyContextWithReason()
    {
        using var setupScope = fixture.Factory.Services.CreateScope();
        var db = setupScope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();

        // A slot that exists but sits outside the queried window, so the window
        // itself comes back empty while "next available" can still point at it.
        var futureSlot = await TestData.CreateSlotAsync(
            db, capacityRemaining: 3, startsAt: DateTimeOffset.UtcNow.AddDays(30));
        var resourceTypeId = futureSlot.Resource.ResourceTypeId;

        var client = fixture.Factory.CreateClient();
        var from = DateTimeOffset.UtcNow.ToString("O");
        var to = DateTimeOffset.UtcNow.AddHours(1).ToString("O");

        var response = await client.GetAsync(
            $"/availability?resourceTypeId={resourceTypeId}&from={Uri.EscapeDataString(from)}&to={Uri.EscapeDataString(to)}");

        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<AvailabilityResponse>();

        Assert.NotNull(body);
        Assert.Empty(body.Slots);
        Assert.NotNull(body.EmptyContext);
        Assert.Equal("filtered", body.EmptyContext!.Reason);
        Assert.NotNull(body.EmptyContext.NextAvailableAt);
    }

    [Fact]
    public async Task GetAvailability_TextSearch_MatchesResourceName()
    {
        using var setupScope = fixture.Factory.Services.CreateScope();
        var db = setupScope.ServiceProvider.GetRequiredService<BookingEngineDbContext>();

        var slot = await TestData.CreateSlotAsync(db, capacityRemaining: 2, startsAt: DateTimeOffset.UtcNow.AddHours(2));
        var uniqueFragment = slot.Resource.Name.Split(' ')[^1]; // the trailing Guid-N chunk

        var client = fixture.Factory.CreateClient();
        var from = DateTimeOffset.UtcNow.ToString("O");
        var to = DateTimeOffset.UtcNow.AddDays(1).ToString("O");

        var hit = await client.GetFromJsonAsync<AvailabilityResponse>(
            $"/availability?q={Uri.EscapeDataString(uniqueFragment)}&from={Uri.EscapeDataString(from)}&to={Uri.EscapeDataString(to)}");
        var miss = await client.GetFromJsonAsync<AvailabilityResponse>(
            $"/availability?q=zzz-no-such-resource&from={Uri.EscapeDataString(from)}&to={Uri.EscapeDataString(to)}");

        Assert.NotNull(hit);
        Assert.Contains(hit!.Slots, s => s.Id == slot.Id);
        Assert.NotNull(miss);
        Assert.Empty(miss!.Slots);
        Assert.Equal("noResults", miss.EmptyContext!.Reason);
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
