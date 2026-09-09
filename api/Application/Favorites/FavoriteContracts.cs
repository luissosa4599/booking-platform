namespace BookingEngine.Api.Application.Favorites;

public record CreateFavoriteRequest(Guid ResourceId);

/// <summary>
/// A favorited resource, flattened enough for the Explore list and the guest
/// profile to render without a second fetch.
/// </summary>
public record FavoriteResourceResponse(
    Guid ResourceId,
    string Name,
    string LocationName,
    string? LocationAddress,
    Guid ResourceTypeId);
