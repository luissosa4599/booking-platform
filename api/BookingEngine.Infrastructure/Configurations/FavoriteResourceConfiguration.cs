using BookingEngine.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BookingEngine.Infrastructure.Configurations;

public class FavoriteResourceConfiguration : IEntityTypeConfiguration<FavoriteResource>
{
    public void Configure(EntityTypeBuilder<FavoriteResource> builder)
    {
        builder.HasKey(f => f.Id);

        builder.Property(f => f.UserId)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(f => f.CreatedAt).IsRequired();

        builder.HasOne(f => f.Resource)
            .WithMany()
            .HasForeignKey(f => f.ResourceId)
            .OnDelete(DeleteBehavior.Cascade);

        // Favoriting is a toggle — re-favoriting the same resource upserts this
        // row instead of adding a duplicate.
        builder.HasIndex(f => new { f.UserId, f.ResourceId }).IsUnique();
    }
}
