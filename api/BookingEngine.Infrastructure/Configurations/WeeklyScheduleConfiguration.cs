using BookingEngine.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BookingEngine.Infrastructure.Configurations;

public class WeeklyScheduleConfiguration : IEntityTypeConfiguration<WeeklySchedule>
{
    public void Configure(EntityTypeBuilder<WeeklySchedule> builder)
    {
        builder.HasKey(w => w.Id);

        builder.Property(w => w.SlotDurationMinutes).IsRequired();
        builder.Property(w => w.Capacity).IsRequired();
        builder.Property(w => w.UpdatedAt).IsRequired();

        builder.HasIndex(w => w.ResourceId).IsUnique();

        builder.HasMany(w => w.Days)
            .WithOne(d => d.WeeklySchedule)
            .HasForeignKey(d => d.WeeklyScheduleId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class WeeklyScheduleDayConfiguration : IEntityTypeConfiguration<WeeklyScheduleDay>
{
    public void Configure(EntityTypeBuilder<WeeklyScheduleDay> builder)
    {
        builder.HasKey(d => d.Id);

        builder.Property(d => d.Weekday)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(12);

        builder.Property(d => d.OpenTime).IsRequired();
        builder.Property(d => d.CloseTime).IsRequired();
        builder.Property(d => d.Enabled).IsRequired();

        builder.HasIndex(d => new { d.WeeklyScheduleId, d.Weekday }).IsUnique();
    }
}
