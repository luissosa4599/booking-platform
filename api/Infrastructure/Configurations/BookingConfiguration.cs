using BookingEngine.Api.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BookingEngine.Api.Infrastructure.Configurations;

public class BookingConfiguration : IEntityTypeConfiguration<Booking>
{
    public void Configure(EntityTypeBuilder<Booking> builder)
    {
        builder.HasKey(b => b.Id);

        builder.Property(b => b.UserId)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(b => b.Status)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(20);

        builder.Property(b => b.IdempotencyKey)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(b => b.CreatedAt).IsRequired();

        builder.HasOne(b => b.AvailabilitySlot)
            .WithMany(s => s.Bookings)
            .HasForeignKey(b => b.AvailabilitySlotId)
            .OnDelete(DeleteBehavior.Restrict);

        // Enforces the idempotency contract at the database level, not just
        // in application code: two POST /bookings with the same key can
        // never both insert, even under concurrent requests.
        builder.HasIndex(b => b.IdempotencyKey).IsUnique();

        builder.HasIndex(b => b.AvailabilitySlotId);
    }
}
