using System.Security.Claims;
using BookingEngine.Domain;
using Microsoft.IdentityModel.JsonWebTokens;

namespace BookingEngine.Api.Application.Auth;

public static class ClaimsPrincipalExtensions
{
    /// <summary>The <c>role</c> claim value ("guest"/"host") — lowercase, matches the "Host" auth policy.</summary>
    public const string RoleClaim = "role";

    /// <summary>
    /// The authenticated user's id (our <c>sub</c> claim). Empty string only if
    /// called on an unauthenticated principal — endpoints that use it are
    /// behind <c>RequireAuthorization()</c>, so that never happens in practice.
    /// </summary>
    public static string UserId(this ClaimsPrincipal principal) =>
        principal.FindFirstValue(JwtRegisteredClaimNames.Sub)
        ?? principal.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? string.Empty;

    /// <summary>The role carried in the access token. Defaults to Guest when the claim is absent (older tokens).</summary>
    public static AccountRole Role(this ClaimsPrincipal principal) =>
        principal.FindFirstValue(RoleClaim) == "host" ? AccountRole.Host : AccountRole.Guest;

    public static bool IsHost(this ClaimsPrincipal principal) =>
        principal.FindFirstValue(RoleClaim) == "host";
}
