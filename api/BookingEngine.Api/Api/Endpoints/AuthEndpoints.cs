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
            var name = DisplayNames.Normalize(request.Name);
            if (DisplayNames.IsTooLong(name))
            {
                return Results.BadRequest(new { message = "Name is too long." });
            }

            var email = request.Email.Trim().ToLowerInvariant();
            var id = MagicLinkTokens.UserIdFor(email);
            var now = DateTimeOffset.UtcNow;
            var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id, ct);

            // Any existing account is a 409 — including one without a password
            // (signed up with Google). Registering never attaches a password to
            // an account the caller hasn't proven they own: that used to let
            // anyone who knew a Google user's email set a password on it and
            // sign in as them. A Google user who wants a password goes through
            // /auth/forgot-password instead, which proves the email.
            if (user is not null)
            {
                return string.IsNullOrEmpty(user.PasswordHash)
                    ? Results.Conflict(new { message = "This account signs in with Google.", code = "google_account" })
                    : Results.Conflict(new { message = "An account with this email already exists.", code = "email_taken" });
            }

            // Same id derivation as Google/magic-link — if this email later
            // signs in with Google, it resolves to this same account.
            user = new User { Id = id, Email = email, CreatedAt = now };
            db.Users.Add(user);

            user.PasswordHash = PasswordHasher.Hash(request.Password);
            user.DisplayName = name;
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

            // Always a 401 (older app builds only look at the status), but the
            // body says which case it is: the sign-in screen sends an unknown
            // email to a "create your account?" step instead of creating one
            // silently, and a Google account to "sign in with Google". This
            // reveals whether an email has an account — /auth/register's 409
            // already did, and the global per-IP rate limiter caps probing.
            if (user is null)
            {
                return Results.Json(
                    new { message = "No account with this email.", code = "no_account" },
                    statusCode: StatusCodes.Status401Unauthorized);
            }
            if (string.IsNullOrEmpty(user.PasswordHash))
            {
                return Results.Json(
                    new { message = "This account signs in with Google.", code = "google_account" },
                    statusCode: StatusCodes.Status401Unauthorized);
            }
            if (!PasswordHasher.Verify(request.Password, user.PasswordHash))
            {
                return Results.Json(
                    new { message = "Wrong password.", code = "wrong_password" },
                    statusCode: StatusCodes.Status401Unauthorized);
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
                var token = PasswordResetTokens.Issue(email, user.PasswordHash, authOptions.Secret, now);
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

        // Lets the reset screen show "this link no longer works" as soon as it
        // opens, instead of after the user has typed a new password. Read-only:
        // validating doesn't use the link up.
        app.MapPost("/auth/reset-password/check", async (
            ResetTokenCheckRequest request,
            AuthOptions authOptions,
            BookingEngineDbContext db,
            CancellationToken ct) =>
        {
            var user = await FindResetTokenUserAsync(request.Token, authOptions, db, ct);
            return user is null
                ? Results.BadRequest(new { message = "This link is invalid or has expired.", code = "invalid_token" })
                : Results.Ok(new ResetTokenCheckResponse(user.Email));
        })
        .WithName("CheckResetToken");

        app.MapPost("/auth/reset-password", async (
            ResetPasswordRequest request,
            AuthOptions authOptions,
            SessionIssuer issuer,
            BookingEngineDbContext db,
            CancellationToken ct) =>
        {
            var user = await FindResetTokenUserAsync(request.Token, authOptions, db, ct);
            if (user is null)
            {
                return Results.BadRequest(new { message = "This link is invalid or has expired.", code = "invalid_token" });
            }
            if (!PasswordHasher.IsValidPassword(request.NewPassword))
            {
                return Results.BadRequest(new { message = "Password must be at least 8 characters.", code = "weak_password" });
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

    /// <summary>
    /// The account a reset link belongs to, or null when the link is forged,
    /// expired, for an unknown account, or already used (the password changed
    /// since it was issued — see <see cref="PasswordResetTokens"/>).
    /// </summary>
    private static async Task<User?> FindResetTokenUserAsync(
        string token,
        AuthOptions authOptions,
        BookingEngineDbContext db,
        CancellationToken ct)
    {
        if (!PasswordResetTokens.TryValidate(
                token, authOptions.Secret, DateTimeOffset.UtcNow, out var email, out var stamp))
        {
            return null;
        }

        var id = MagicLinkTokens.UserIdFor(email);
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id, ct);
        return user is not null && PasswordResetTokens.StampMatches(stamp, user.PasswordHash, authOptions.Secret)
            ? user
            : null;
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
