using BookingEngine.Api.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BookingEngine.Api.Infrastructure.Configurations;

public class LocationConfiguration : IEntityTypeConfiguration<Location>
{
    public void Configure(EntityTypeBuilder<Location> builder)
    {
        builder.HasKey(l => l.Id);

        builder.Property(l => l.Name)
            .IsRequired()
            .HasMaxLength(150);

        builder.Property(l => l.Address)
            .HasMaxLength(300);

        builder.Property(l => l.TimeZone)
            .IsRequired()
            .HasMaxLength(100);
    }
}
