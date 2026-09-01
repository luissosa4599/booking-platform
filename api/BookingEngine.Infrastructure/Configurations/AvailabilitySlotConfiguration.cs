using BookingEngine.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BookingEngine.Infrastructure.Configurations;

public class AvailabilitySlotConfiguration : IEntityTypeConfiguration<AvailabilitySlot>
{
    public void Configure(EntityTypeBuilder<AvailabilitySlot> builder)
    {
        builder.HasKey(s => s.Id);

        builder.Property(s => s.StartsAt).IsRequired();
        builder.Property(s => s.EndsAt).IsRequired();
        builder.Property(s => s.CapacityRemaining).IsRequired();

        // Npgsql-specific optimistic concurrency: maps a uint property to
        // PostgreSQL's `xmin` system column instead of a real column. EF
        // throws DbUpdateConcurrencyException on SaveChanges if the row
        // changed since it was read — this is what makes two simultaneous
        // bookings for the last seat resolve to one 201 and one 409.
        builder.Property(s => s.RowVersion).IsRowVersion();

        builder.HasOne(s => s.Resource)
            .WithMany(r => r.AvailabilitySlots)
            .HasForeignKey(s => s.ResourceId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(s => new { s.ResourceId, s.StartsAt });
    }
}
