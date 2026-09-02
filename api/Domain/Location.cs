namespace BookingEngine.Api.Domain;

public class Location
{
    public Guid Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string? Address { get; set; }

    /// <summary>IANA time zone id (e.g. "America/Mexico_City").</summary>
    public string TimeZone { get; set; } = string.Empty;

    /// <summary>Coordinates for the map preview + "get directions" link. Both null or both set.</summary>
    public double? Latitude { get; set; }

    public double? Longitude { get; set; }

    public ICollection<Resource> Resources { get; set; } = new List<Resource>();
}
