using BookingEngine.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BookingEngine.Infrastructure.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.HasKey(u => u.Id);

        // Matches Booking.UserId / WaitlistEntry.UserId (guid string, "D" format).
        builder.Property(u => u.Id).HasMaxLength(200);

        builder.Property(u => u.Email)
            .IsRequired()
            .HasMaxLength(320);

        builder.Property(u => u.GoogleSub).HasMaxLength(255);

        builder.Property(u => u.DisplayName).HasMaxLength(200);

        builder.Property(u => u.AvatarUrl).HasMaxLength(1000);

        // Stored as a string ("Guest"/"Host"), same pattern as Booking.Status.
        // HasDefaultValue backfills existing rows when the column is added.
        builder.Property(u => u.Role)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(20)
            .HasDefaultValue(AccountRole.Guest);

        builder.Property(u => u.CreatedAt).IsRequired();

        builder.Property(u => u.LastSeenAt).IsRequired();

        builder.HasIndex(u => u.Email).IsUnique();

        builder.HasIndex(u => u.GoogleSub)
            .IsUnique()
            .HasFilter(null);
    }
}
