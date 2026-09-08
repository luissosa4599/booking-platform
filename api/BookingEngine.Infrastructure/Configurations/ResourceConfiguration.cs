using BookingEngine.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BookingEngine.Infrastructure.Configurations;

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

        builder.Property(r => r.OwnerUserId).HasMaxLength(200);
        builder.HasIndex(r => r.OwnerUserId);

        builder.HasOne(r => r.WeeklySchedule)
            .WithOne(w => w.Resource)
            .HasForeignKey<WeeklySchedule>(w => w.ResourceId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(r => r.ResourceTypeId);
        builder.HasIndex(r => r.LocationId);
    }
}
