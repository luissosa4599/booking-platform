namespace BookingEngine.Api.Application.Me;

/// <summary>
/// <c>GET /me</c> — the signed-in account plus the two counters the profile
/// screen shows (so it needs one request, not three). <c>Role</c> is lowercase
/// ("guest"/"host") to match the access-token claim.
/// </summary>
public record MeResponse(
    string Id,
    string Email,
    string? DisplayName,
    string? AvatarUrl,
    string Role,
    int BookingCount,
    int StreakWeeks,
    DateTimeOffset CreatedAt);
