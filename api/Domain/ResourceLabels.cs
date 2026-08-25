namespace BookingEngine.Api.Domain;

/// <summary>
/// Owned type — the domain-specific nouns a client's UI reads instead of
/// hardcoding e.g. "sala"/"salas"/"Apartar". Mapped as an EF Core owned type
/// (same table as ResourceType, no separate FK).
/// </summary>
public class ResourceLabels
{
    public string Singular { get; set; } = string.Empty;

    public string Plural { get; set; } = string.Empty;

    /// <summary>
    /// Not in the original field list but present in the handoff's own domain
    /// model (docs/design-handoff.md, "Domain model") and used by UI copy like
    /// "3 personas" — added for alignment with what the UI actually needs.
    /// </summary>
    public string CapacityUnit { get; set; } = string.Empty;

    public string ActionVerb { get; set; } = string.Empty;
}
