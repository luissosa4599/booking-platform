namespace BookingEngine.Domain;

public enum SlotOrigin
{
    /// <summary>Added by hand by the host (or by the dev seeder). Never auto-deleted.</summary>
    Adhoc,

    /// <summary>Generated from the resource's <see cref="WeeklySchedule"/>. Regenerated/pruned by the expander.</summary>
    Schedule,
}
