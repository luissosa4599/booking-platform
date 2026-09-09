using BookingEngine.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BookingEngine.Infrastructure.Configurations;

public class ResourceImageConfiguration : IEntityTypeConfiguration<ResourceImage>
{
    public void Configure(EntityTypeBuilder<ResourceImage> builder)
    {
        builder.HasKey(i => i.Id);

        builder.Property(i => i.Url)
            .IsRequired()
            .HasMaxLength(600);

        builder.Property(i => i.CreatedAt).IsRequired();

        builder.HasOne(i => i.Resource)
            .WithMany(r => r.Images)
            .HasForeignKey(i => i.ResourceId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(i => new { i.ResourceId, i.Position });
    }
}
