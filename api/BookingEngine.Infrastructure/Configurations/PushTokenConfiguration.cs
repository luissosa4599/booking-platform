using BookingEngine.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BookingEngine.Infrastructure.Configurations;

public class PushTokenConfiguration : IEntityTypeConfiguration<PushToken>
{
    public void Configure(EntityTypeBuilder<PushToken> builder)
    {
        builder.HasKey(t => t.Id);

        builder.Property(t => t.UserId)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(t => t.ExpoPushToken)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(t => t.Platform)
            .IsRequired()
            .HasMaxLength(20);

        builder.Property(t => t.UpdatedAt).IsRequired();

        // A device re-registering (app reinstall, permission re-grant) upserts
        // the same row instead of accumulating duplicates.
        builder.HasIndex(t => new { t.UserId, t.ExpoPushToken }).IsUnique();
    }
}
