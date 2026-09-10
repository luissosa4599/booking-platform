using BookingEngine.Domain;
using BookingEngine.Infrastructure;

namespace BookingEngine.Api.Application.Auth;

/// <summary>
/// Mints a fresh first-party session for a user: adds a new refresh-token row and
/// returns a signed access token + the raw refresh token. Extracted from
/// <c>AuthEndpoints</c> so <c>POST /me/become-host</c> can also re-issue a session
/// (the caller's old access token still says <c>role=guest</c> for up to ~30 min).
/// Does NOT rotate/revoke existing refresh tokens — it's an additive issue, same
/// as a normal sign-in.
/// </summary>
public class SessionIssuer(SessionTokens tokens, AuthOptions authOptions)
{
    public async Task<SessionResponse> IssueAsync(
        BookingEngineDbContext db, User user, DateTimeOffset now, CancellationToken ct)
    {
        var (raw, hash) = SessionTokens.NewRefreshToken();
        db.RefreshTokens.Add(new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TokenHash = hash,
            CreatedAt = now,
            ExpiresAt = now.Add(authOptions.RefreshTokenLifetime),
        });
        await db.SaveChangesAsync(ct);

        var access = tokens.IssueAccessToken(user, now);
        return new SessionResponse(
            access,
            raw,
            now.Add(authOptions.AccessTokenLifetime),
            ToAuthUser(user));
    }

    public static AuthUser ToAuthUser(User user) =>
        new(user.Id, user.Email, user.DisplayName, user.AvatarUrl, user.Role.ToString().ToLowerInvariant());
}
