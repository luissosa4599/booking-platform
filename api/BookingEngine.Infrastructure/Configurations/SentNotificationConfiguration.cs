using BookingEngine.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BookingEngine.Infrastructure.Configurations;

public class SentNotificationConfiguration : IEntityTypeConfiguration<SentNotification>
{
    public void Configure(EntityTypeBuilder<SentNotification> builder)
    {
        builder.HasKey(s => s.Id);

        builder.Property(s => s.UserId)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(s => s.Type)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(s => s.SentAt).IsRequired();

        // Dedupe lookups: "did I already remind this user about this booking?" /
        // "...already tell this user a spot opened on this slot?".
        builder.HasIndex(s => new { s.UserId, s.Type, s.BookingId });
        builder.HasIndex(s => new { s.UserId, s.Type, s.AvailabilitySlotId });
    }
}
