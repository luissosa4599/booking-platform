using BookingEngine.Domain;
using Microsoft.EntityFrameworkCore;

namespace BookingEngine.Infrastructure;

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

    public DbSet<WeeklySchedule> WeeklySchedules => Set<WeeklySchedule>();

    public DbSet<WeeklyScheduleDay> WeeklyScheduleDays => Set<WeeklyScheduleDay>();

    public DbSet<Booking> Bookings => Set<Booking>();

    public DbSet<WaitlistEntry> WaitlistEntries => Set<WaitlistEntry>();

    public DbSet<User> Users => Set<User>();

    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    public DbSet<PushToken> PushTokens => Set<PushToken>();

    public DbSet<NotificationOutbox> NotificationOutbox => Set<NotificationOutbox>();

    public DbSet<SentNotification> SentNotifications => Set<SentNotification>();

    public DbSet<FavoriteResource> Favorites => Set<FavoriteResource>();

    public DbSet<ResourceImage> ResourceImages => Set<ResourceImage>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(BookingEngineDbContext).Assembly);
    }
}
