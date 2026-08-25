using BookingEngine.Api.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BookingEngine.Api.Infrastructure.Configurations;

public class ResourceTypeConfiguration : IEntityTypeConfiguration<ResourceType>
{
    public void Configure(EntityTypeBuilder<ResourceType> builder)
    {
        builder.HasKey(t => t.Id);

        builder.Property(t => t.Name)
            .IsRequired()
            .HasMaxLength(100);

        builder.OwnsOne(t => t.Labels, labels =>
        {
            labels.Property(l => l.Singular).IsRequired().HasMaxLength(50);
            labels.Property(l => l.Plural).IsRequired().HasMaxLength(50);
            labels.Property(l => l.CapacityUnit).IsRequired().HasMaxLength(50);
            labels.Property(l => l.ActionVerb).IsRequired().HasMaxLength(50);
        });
    }
}
