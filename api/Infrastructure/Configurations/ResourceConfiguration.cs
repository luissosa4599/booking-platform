using BookingEngine.Api.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BookingEngine.Api.Infrastructure.Configurations;

public class ResourceConfiguration : IEntityTypeConfiguration<Resource>
{
    public void Configure(EntityTypeBuilder<Resource> builder)
    {
        builder.HasKey(r => r.Id);

        builder.Property(r => r.Name)
            .IsRequired()
            .HasMaxLength(150);

        builder.Property(r => r.Description)
            .HasMaxLength(1000);

        builder.HasOne(r => r.ResourceType)
            .WithMany(t => t.Resources)
            .HasForeignKey(r => r.ResourceTypeId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(r => r.Location)
            .WithMany(l => l.Resources)
            .HasForeignKey(r => r.LocationId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(r => r.ResourceTypeId);
        builder.HasIndex(r => r.LocationId);
    }
}
