using BookingEngine.Api.Application.Auth;
using BookingEngine.Api.Infrastructure.Email;
using BookingEngine.Domain;
using BookingEngine.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace BookingEngine.Api.Api.Endpoints;

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        // --- Email + password -----------------------------------------------------

        app.MapPost("/auth/register", async (
            RegisterRequest request,
            SessionIssuer issuer,
            BookingEngineDbContext db,
            ILogger<Program> logger,
            CancellationToken ct) =>
        {
            if (!MagicLinkTokens.IsValidEmail(request.Email))
            {
                return Results.BadRequest(new { message = "Enter a valid email address." });
            }
            if (!PasswordHasher.IsValidPassword(request.Password))
            {
                return Results.BadRequest(new { message = "Password must be at least 8 characters." });
            }

            var email = request.Email.Trim().ToLowerInvariant();
            var id = MagicLinkTokens.UserIdFor(email);
            var now = DateTimeOffset.UtcNow;
            var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id, ct);

            if (user is not null && !string.IsNullOrEmpty(user.PasswordHash))
            {
                return Results.Conflict(new { message = "An account with this email already exists." });
            }

            if (user is null)
            {
                // Same id derivation as Google/magic-link — if this email later
                // signs in with Google, it resolves to this same account.
                user = new User { Id = id, Email = email, CreatedAt = now };
                db.Users.Add(user);
            }

            user.PasswordHash = PasswordHasher.Hash(request.Password);
            user.LastSeenAt = now;

            var session = await issuer.IssueAsync(db, user, now, ct);
            logger.LogInformation("Password registration for {Email} ({UserId})", user.Email, user.Id);
            return Results.Ok(session);
        })
        .WithName("Register");

        app.MapPost("/auth/login", async (
            LoginRequest request,
            SessionIssuer issuer,
            BookingEngineDbContext db,
            CancellationToken ct) =>
        {
            var email = request.Email.Trim().ToLowerInvariant();
            var id = MagicLinkTokens.UserIdFor(email);
            var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id, ct);

            // Same generic 401 whether the email is unknown or the password is
            // wrong — never reveal which one.
            if (user is null || !PasswordHasher.Verify(request.Password, user.PasswordHash))
            {
                return Results.Unauthorized();
            }

            var now = DateTimeOffset.UtcNow;
            user.LastSeenAt = now;
            var session = await issuer.IssueAsync(db, user, now, ct);
            return Results.Ok(session);
        })
        .WithName("Login");

        app.MapPost("/auth/forgot-password", async (
            ForgotPasswordRequest request,
            AuthOptions authOptions,
            IEmailSender emailSender,
            IConfiguration config,
            IWebHostEnvironment env,
            BookingEngineDbContext db,
            ILogger<Program> logger,
            CancellationToken ct) =>
        {
            // Always the same response shape regardless of whether the email
            // exists or is even well-formed — don't leak which emails have
            // accounts. Only Development attaches a debug token (no mail
            // sender is wired for local testing, same fallback as the dev
            // magic link).
            const string genericMessage = "If that email has an account, we sent a password reset link.";

            if (!MagicLinkTokens.IsValidEmail(request.Email))
            {
                return Results.Ok(new ForgotPasswordResponse(genericMessage));
            }

            var email = request.Email.Trim().ToLowerInvariant();
            var id = MagicLinkTokens.UserIdFor(email);
            var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id, ct);
            var now = DateTimeOffset.UtcNow;

            string? debugToken = null;
            string? debugLink = null;

            if (user is not null)
            {
                var token = PasswordResetTokens.Issue(email, authOptions.Secret, now);
                var configuredFrontend = config["FRONTEND_WEB_URL"];
                var frontend = string.IsNullOrWhiteSpace(configuredFrontend)
                    ? "http://localhost:8081"
                    : configuredFrontend;
                var link = $"{frontend}/reset-password?token={Uri.EscapeDataString(token)}";

                // Spanish prose a real person reads via email — \u escapes for
                // accents keep the .cs source ASCII-only (CP1252/no-BOM gotcha,
                // see CLAUDE.md) without dropping them from the actual copy.
                var sent = await emailSender.SendAsync(
                    email,
                    "Restablece tu contraseña de Tempo",
                    $"<p>Recibimos una solicitud para restablecer tu contraseña de Tempo.</p>" +
                        $"<p><a href=\"{link}\">Haz clic aquí para continuar</a></p>" +
                        "<p>Este enlace vence en 30 minutos. Si no lo solicitaste, ignora este mensaje.</p>",
                    ct);

                if (!sent)
                {
                    logger.LogWarning(
                        "Password reset email not sent for {Email} (sender disabled or the send failed)", email);
                }

                if (env.IsDevelopment())
                {
                    debugToken = token;
                    debugLink = link;
                }
            }

            return Results.Ok(new ForgotPasswordResponse(genericMessage, debugToken, debugLink));
        })
        .WithName("ForgotPassword");

        app.MapPost("/auth/reset-password", async (
            ResetPasswordRequest request,
            AuthOptions authOptions,
            SessionIssuer issuer,
            BookingEngineDbContext db,
            CancellationToken ct) =>
        {
            if (!PasswordResetTokens.TryValidate(request.Token, authOptions.Secret, DateTimeOffset.UtcNow, out var email))
            {
                return Results.BadRequest(new { message = "This link is invalid or has expired." });
            }
            if (!PasswordHasher.IsValidPassword(request.NewPassword))
            {
                return Results.BadRequest(new { message = "Password must be at least 8 characters." });
            }

            var id = MagicLinkTokens.UserIdFor(email);
            var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id, ct);
            if (user is null)
            {
                return Results.BadRequest(new { message = "This link is invalid or has expired." });
            }

            var now = DateTimeOffset.UtcNow;
            user.PasswordHash = PasswordHasher.Hash(request.NewPassword);
            user.LastSeenAt = now;

            // A password reset is a credential change — revoke every existing
            // session (same "assume compromise" posture as the refresh-token
            // replay defense) rather than leaving old logged-in devices active.
            await db.RefreshTokens
                .Where(t => t.UserId == user.Id && t.RevokedAt == null)
                .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now), ct);

            var session = await issuer.IssueAsync(db, user, now, ct);
            return Results.Ok(session);
        })
        .WithName("ResetPassword");

        // --- Google OAuth2 → first-party session ---------------------------------

        app.MapPost("/auth/google", async (
            GoogleSignInRequest request,
            IGoogleIdTokenValidator googleValidator,
            SessionIssuer issuer,
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
            var session = await issuer.IssueAsync(db, user, now, ct);

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
                SessionIssuer.ToAuthUser(stored.User)));
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
            SessionIssuer issuer,
            BookingEngineDbContext db,
            CancellationToken ct) =>
        {
            if (!MagicLinkTokens.TryValidate(request.Token, authOptions.Secret, DateTimeOffset.UtcNow, out var email))
            {
                return Results.BadRequest(new { message = "This link is invalid or has expired." });
            }

            var now = DateTimeOffset.UtcNow;
            var user = await UpsertMagicLinkUserAsync(db, email, now, ct);
            var session = await issuer.IssueAsync(db, user, now, ct);
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

}
