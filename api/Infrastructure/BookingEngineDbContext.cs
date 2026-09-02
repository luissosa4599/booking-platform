using BookingEngine.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace BookingEngine.Api.Infrastructure;

public class BookingEngineDbContext : DbContext
{
    public BookingEngineDbContext(DbContextOptions<BookingEngineDbContext> options)
        : base(options)
    {
    }

    public DbSet<ResourceType> ResourceTypes => Set<ResourceType>();

    public DbSet<Location> Locations => Set<Location>();

    public DbSet<Resource> Resources => Set<Resource>();

    public DbSet<AvailabilitySlot> AvailabilitySlots => Set<AvailabilitySlot>();

    public DbSet<Booking> Bookings => Set<Booking>();

    public DbSet<WaitlistEntry> WaitlistEntries => Set<WaitlistEntry>();

    public DbSet<User> Users => Set<User>();

    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(BookingEngineDbContext).Assembly);
    }
}
