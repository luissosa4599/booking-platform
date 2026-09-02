namespace BookingEngine.Domain;

/// <summary>
/// The configurable "vertical" of a resource (study rooms, medical appointments,
/// equipment rentals, ...). The UI never hardcodes domain nouns — it reads
/// <see cref="Labels"/> instead, so swapping the tenant doesn't touch a single
/// screen. See docs/design-handoff.md, "Domain model".
/// </summary>
public class ResourceType
{
    public Guid Id { get; set; }

    /// <summary>Internal name, not shown to end users (they see <see cref="Labels"/>).</summary>
    public string Name { get; set; } = string.Empty;

    public ResourceLabels Labels { get; set; } = new();

    public bool AllowsMultipleSeats { get; set; }

    public bool AllowsWaitlist { get; set; }

    public ICollection<Resource> Resources { get; set; } = new List<Resource>();
}
