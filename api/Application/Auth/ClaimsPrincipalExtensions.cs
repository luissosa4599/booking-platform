using System.Security.Claims;
using Microsoft.IdentityModel.JsonWebTokens;

namespace BookingEngine.Api.Application.Auth;

public static class ClaimsPrincipalExtensions
{
    /// <summary>
    /// The authenticated user's id (our <c>sub</c> claim). Empty string only if
    /// called on an unauthenticated principal — endpoints that use it are
    /// behind <c>RequireAuthorization()</c>, so that never happens in practice.
    /// </summary>
    public static string UserId(this ClaimsPrincipal principal) =>
        principal.FindFirstValue(JwtRegisteredClaimNames.Sub)
        ?? principal.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? string.Empty;
}
