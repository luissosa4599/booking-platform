namespace BookingEngine.Domain;

/// <summary>
/// A host-uploaded photo of a resource. Stored as a URL (the object lives in a
/// GCS bucket); <see cref="Position"/> is the display order, contiguous from 0.
/// </summary>
public class ResourceImage
{
    public Guid Id { get; set; }

    public Guid ResourceId { get; set; }

    public Resource Resource { get; set; } = null!;

    public string Url { get; set; } = string.Empty;

    public int Position { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}
