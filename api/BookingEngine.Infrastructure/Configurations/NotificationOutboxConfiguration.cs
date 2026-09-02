using BookingEngine.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BookingEngine.Infrastructure.Configurations;

public class NotificationOutboxConfiguration : IEntityTypeConfiguration<NotificationOutbox>
{
    public void Configure(EntityTypeBuilder<NotificationOutbox> builder)
    {
        builder.HasKey(o => o.Id);

        builder.Property(o => o.Type)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(o => o.CreatedAt).IsRequired();

        builder.Property(o => o.Attempts).IsRequired();

        // The worker's poll query: unprocessed rows, oldest first.
        builder.HasIndex(o => o.ProcessedAt);
    }
}
