using BookingEngine.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BookingEngine.Infrastructure.Configurations;

public class WaitlistEntryConfiguration : IEntityTypeConfiguration<WaitlistEntry>
{
    public void Configure(EntityTypeBuilder<WaitlistEntry> builder)
    {
        builder.HasKey(w => w.Id);

        builder.Property(w => w.UserId)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(w => w.CreatedAt).IsRequired();

        builder.HasOne(w => w.AvailabilitySlot)
            .WithMany(s => s.WaitlistEntries)
            .HasForeignKey(w => w.AvailabilitySlotId)
            .OnDelete(DeleteBehavior.Cascade);

        // Supports "eres el N.º en la lista" — computed by counting earlier
        // rows for the same slot, not stored (positions would need to shift
        // every time someone ahead cancels or gets notified).
        builder.HasIndex(w => new { w.AvailabilitySlotId, w.CreatedAt });
    }
}
