using BookingEngine.Api.Application.Auth;
using BookingEngine.Api.Domain;
using BookingEngine.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace BookingEngine.Api.Api.Endpoints;

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        // --- Google OAuth2 → first-party session ---------------------------------

        app.MapPost("/auth/google", async (
            GoogleSignInRequest request,
            IGoogleIdTokenValidator googleValidator,
            SessionTokens tokens,
            AuthOptions authOptions,
            BookingEngineDbContext db,
            ILogger<Program> logger,
            CancellationToken ct) =>
        {
            var identity = await googleValidator.ValidateAsync(request.IdToken, ct);
            if (identity is null)
            {
                return Results.Unauthorized();
            }

            var now = DateTimeOffset.UtcNow;
            var user = await UpsertGoogleUserAsync(db, identity, now, ct);
            var session = await IssueSessionAsync(db, user, tokens, authOptions, now, ct);

            logger.LogInformation("Google sign-in for {Email} ({UserId})", user.Email, user.Id);
            return Results.Ok(session);
        })
        .WithName("GoogleSignIn");

        app.MapPost("/auth/refresh", async (
            RefreshRequest request,
            SessionTokens tokens,
            AuthOptions authOptions,
            BookingEngineDbContext db,
            ILogger<Program> logger,
            CancellationToken ct) =>
        {
            var now = DateTimeOffset.UtcNow;
            var hash = SessionTokens.HashRefreshToken(request.RefreshToken);

            var stored = await db.RefreshTokens
                .Include(t => t.User)
                .FirstOrDefaultAsync(t => t.TokenHash == hash, ct);

            if (stored is null || !stored.IsActive(now))
            {
                // Re-use of a rotated/revoked token is a red flag — nuke every
                // token for that user so a leaked chain can't be continued.
                if (stored is not null)
                {
                    logger.LogWarning("Refresh token replay for {UserId} — revoking all sessions", stored.UserId);
                    await db.RefreshTokens
                        .Where(t => t.UserId == stored.UserId && t.RevokedAt == null)
                        .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now), ct);
                }

                return Results.Unauthorized();
            }

            var (rawNext, hashNext) = SessionTokens.NewRefreshToken();
            stored.RevokedAt = now;
            stored.ReplacedByTokenHash = hashNext;
            db.RefreshTokens.Add(new RefreshToken
            {
                Id = Guid.NewGuid(),
                UserId = stored.UserId,
                TokenHash = hashNext,
                CreatedAt = now,
                ExpiresAt = now.Add(authOptions.RefreshTokenLifetime),
            });

            stored.User.LastSeenAt = now;
            await db.SaveChangesAsync(ct);

            var access = tokens.IssueAccessToken(stored.User, now);
            return Results.Ok(new SessionResponse(
                access,
                rawNext,
                now.Add(authOptions.AccessTokenLifetime),
                ToAuthUser(stored.User)));
        })
        .WithName("RefreshSession");

        app.MapPost("/auth/logout", async (
            LogoutRequest request,
            BookingEngineDbContext db,
            CancellationToken ct) =>
        {
            var hash = SessionTokens.HashRefreshToken(request.RefreshToken);
            await db.RefreshTokens
                .Where(t => t.TokenHash == hash && t.RevokedAt == null)
                .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, DateTimeOffset.UtcNow), ct);

            // Always 204 — don't reveal whether the token existed.
            return Results.NoContent();
        })
        .WithName("Logout");

    }

    /// <summary>
    /// Dev-only simulated magic link — no mail sender. Kept so the app can be
    /// exercised locally (and in Playwright) without real Google credentials.
    /// Program.cs registers this only in Development.
    /// </summary>
    public static void MapDevAuthEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/auth/request-link", (
            RequestLinkRequest request,
            AuthOptions authOptions,
            IConfiguration config,
            ILogger<Program> logger) =>
        {
            if (!MagicLinkTokens.IsValidEmail(request.Email))
            {
                return Results.BadRequest(new { message = "Enter a valid email address." });
            }

            var token = MagicLinkTokens.Issue(request.Email, authOptions.Secret, DateTimeOffset.UtcNow);
            var configuredFrontend = config["FRONTEND_WEB_URL"];
            var frontend = string.IsNullOrWhiteSpace(configuredFrontend)
                ? "http://localhost:8081"
                : configuredFrontend;

            logger.LogInformation("Magic link requested for {Email} (dev, no mail sent)", request.Email);

            return Results.Ok(new RequestLinkResponse(
                token,
                $"{frontend}/auth/verify?token={Uri.EscapeDataString(token)}"));
        })
        .WithName("RequestMagicLink");

        app.MapPost("/auth/verify", async (
            VerifyRequest request,
            AuthOptions authOptions,
            SessionTokens tokens,
            BookingEngineDbContext db,
            CancellationToken ct) =>
        {
            if (!MagicLinkTokens.TryValidate(request.Token, authOptions.Secret, DateTimeOffset.UtcNow, out var email))
            {
                return Results.BadRequest(new { message = "This link is invalid or has expired." });
            }

            var now = DateTimeOffset.UtcNow;
            var user = await UpsertMagicLinkUserAsync(db, email, now, ct);
            var session = await IssueSessionAsync(db, user, tokens, authOptions, now, ct);
            return Results.Ok(session);
        })
        .WithName("VerifyMagicLink");
    }

    private static async Task<User> UpsertGoogleUserAsync(
        BookingEngineDbContext db, GoogleIdentity identity, DateTimeOffset now, CancellationToken ct)
    {
        var email = identity.Email.Trim().ToLowerInvariant();
        var id = MagicLinkTokens.UserIdFor(email);
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id, ct);

        if (user is null)
        {
            user = new User { Id = id, Email = email, CreatedAt = now };
            db.Users.Add(user);
        }

        user.GoogleSub = identity.Subject;
        user.DisplayName = identity.Name ?? user.DisplayName;
        user.AvatarUrl = identity.Picture ?? user.AvatarUrl;
        user.LastSeenAt = now;
        return user;
    }

    private static async Task<User> UpsertMagicLinkUserAsync(
        BookingEngineDbContext db, string email, DateTimeOffset now, CancellationToken ct)
    {
        email = email.Trim().ToLowerInvariant();
        var id = MagicLinkTokens.UserIdFor(email);
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id, ct);

        if (user is null)
        {
            user = new User { Id = id, Email = email, CreatedAt = now };
            db.Users.Add(user);
        }

        user.LastSeenAt = now;
        return user;
    }

    private static async Task<SessionResponse> IssueSessionAsync(
        BookingEngineDbContext db,
        User user,
        SessionTokens tokens,
        AuthOptions authOptions,
        DateTimeOffset now,
        CancellationToken ct)
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

    private static AuthUser ToAuthUser(User user) =>
        new(user.Id, user.Email, user.DisplayName, user.AvatarUrl);
}
