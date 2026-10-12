using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using BookingEngine.Api.Application.Auth;
using BookingEngine.Api.Infrastructure.Email;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;

namespace BookingEngine.Api.Tests;

[Collection("Api")]
public class AuthEndpointsTests(ApiTestFixture fixture)
{
    private static readonly GoogleIdentity SampleIdentity =
        new("google-sub-123", "someone@gmail.com", "Some One", "https://pic");

    private HttpClient ClientWithGoogleStub(GoogleIdentity? identity = null) =>
        fixture.Factory
            .WithWebHostBuilder(b => b.ConfigureTestServices(s =>
                s.AddScoped<IGoogleIdTokenValidator>(_ => new StubGoogleValidator(identity ?? SampleIdentity))))
            .CreateClient();

    [Fact]
    public async Task PostAuthGoogle_ValidIdToken_ReturnsSession()
    {
        var response = await ClientWithGoogleStub()
            .PostAsJsonAsync("/auth/google", new { idToken = "good-token" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var session = await response.Content.ReadFromJsonAsync<SessionResponse>();
        Assert.NotNull(session);
        Assert.False(string.IsNullOrWhiteSpace(session!.AccessToken));
        Assert.False(string.IsNullOrWhiteSpace(session.RefreshToken));
        Assert.Equal("someone@gmail.com", session.User.Email);
    }

    [Fact]
    public async Task PostAuthGoogle_RejectedIdToken_Returns401()
    {
        var response = await ClientWithGoogleStub()
            .PostAsJsonAsync("/auth/google", new { idToken = "bad-token" });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task PostAuthRefresh_RotatesRefreshToken_AndRejectsTheOldOne()
    {
        var client = ClientWithGoogleStub();

        var signIn = await client.PostAsJsonAsync("/auth/google", new { idToken = "good-token" });
        var first = (await signIn.Content.ReadFromJsonAsync<SessionResponse>())!;

        var refreshed = await client.PostAsJsonAsync("/auth/refresh", new { refreshToken = first.RefreshToken });
        Assert.Equal(HttpStatusCode.OK, refreshed.StatusCode);
        var second = (await refreshed.Content.ReadFromJsonAsync<SessionResponse>())!;
        Assert.NotEqual(first.RefreshToken, second.RefreshToken);

        // Re-using the rotated token is rejected.
        var replay = await client.PostAsJsonAsync("/auth/refresh", new { refreshToken = first.RefreshToken });
        Assert.Equal(HttpStatusCode.Unauthorized, replay.StatusCode);

        // ...and the replay attempt revoked the whole chain, so the new one is dead too.
        var afterReplay = await client.PostAsJsonAsync("/auth/refresh", new { refreshToken = second.RefreshToken });
        Assert.Equal(HttpStatusCode.Unauthorized, afterReplay.StatusCode);
    }

    [Fact]
    public async Task GetBookings_WithFreshAccessToken_Succeeds()
    {
        var client = ClientWithGoogleStub();
        var signIn = await client.PostAsJsonAsync("/auth/google", new { idToken = "good-token" });
        var session = (await signIn.Content.ReadFromJsonAsync<SessionResponse>())!;

        using var request = new HttpRequestMessage(HttpMethod.Get, "/bookings?scope=upcoming");
        request.Headers.Authorization = new("Bearer", session.AccessToken);
        var response = await fixture.Factory.CreateClient().SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private sealed class StubGoogleValidator(GoogleIdentity identity) : IGoogleIdTokenValidator
    {
        public Task<GoogleIdentity?> ValidateAsync(string idToken, CancellationToken ct = default) =>
            Task.FromResult(idToken == "good-token" ? identity : null);
    }

    // --- Email + password -----------------------------------------------------

    private static string UniqueEmail() => $"pw-{Guid.NewGuid():N}@tempo.demo";

    [Fact]
    public async Task PostAuthRegister_NewEmail_ReturnsSessionAndAllowsLogin()
    {
        var client = fixture.Factory.CreateClient();
        var email = UniqueEmail();

        var register = await client.PostAsJsonAsync(
            "/auth/register", new RegisterRequest(email, "correct-horse"));
        Assert.Equal(HttpStatusCode.OK, register.StatusCode);
        var session = (await register.Content.ReadFromJsonAsync<SessionResponse>())!;
        Assert.Equal(email, session.User.Email);

        var login = await client.PostAsJsonAsync(
            "/auth/login", new LoginRequest(email, "correct-horse"));
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
    }

    [Fact]
    public async Task PostAuthRegister_WithName_StoresItNormalized_AndPatchMeRenames()
    {
        var client = fixture.Factory.CreateClient();
        var register = await client.PostAsJsonAsync(
            "/auth/register", new RegisterRequest(UniqueEmail(), "correct-horse", "  Ana   María "));
        Assert.Equal(HttpStatusCode.OK, register.StatusCode);
        var session = (await register.Content.ReadFromJsonAsync<SessionResponse>())!;
        Assert.Equal("Ana María", session.User.DisplayName);

        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", session.AccessToken);

        var blank = await client.PatchAsJsonAsync("/me", new { displayName = "   " });
        Assert.Equal(HttpStatusCode.BadRequest, blank.StatusCode);
        var tooLong = await client.PatchAsJsonAsync("/me", new { displayName = new string('a', 81) });
        Assert.Equal(HttpStatusCode.BadRequest, tooLong.StatusCode);

        var rename = await client.PatchAsJsonAsync("/me", new { displayName = "Ana" });
        Assert.Equal(HttpStatusCode.OK, rename.StatusCode);
        var renamed = (await rename.Content.ReadFromJsonAsync<SessionResponse>())!;
        Assert.Equal("Ana", renamed.User.DisplayName);
    }

    [Fact]
    public async Task PostAuthRegister_EmailAlreadyHasAPassword_Returns409()
    {
        var client = fixture.Factory.CreateClient();
        var email = UniqueEmail();
        await client.PostAsJsonAsync("/auth/register", new RegisterRequest(email, "correct-horse"));

        var again = await client.PostAsJsonAsync(
            "/auth/register", new RegisterRequest(email, "another-password"));

        Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);
    }

    [Fact]
    public async Task PostAuthRegister_OnExistingGoogleAccount_Returns409_AndSetsNoPassword()
    {
        // Registering used to attach the caller's password to an existing
        // Google account — anyone who knew the email could take it over.
        var email = "someone@gmail.com"; // matches StubGoogleValidator's SampleIdentity
        var googleClient = ClientWithGoogleStub();
        var signIn = await googleClient.PostAsJsonAsync("/auth/google", new { idToken = "good-token" });
        Assert.Equal(HttpStatusCode.OK, signIn.StatusCode);

        var plainClient = fixture.Factory.CreateClient();
        var register = await plainClient.PostAsJsonAsync(
            "/auth/register", new RegisterRequest(email, "correct-horse"));

        Assert.Equal(HttpStatusCode.Conflict, register.StatusCode);
        var body = await register.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("google_account", body.GetProperty("code").GetString());

        var login = await plainClient.PostAsJsonAsync(
            "/auth/login", new LoginRequest(email, "correct-horse"));
        Assert.Equal(HttpStatusCode.Unauthorized, login.StatusCode);
    }

    [Fact]
    public async Task PostAuthLogin_WrongPassword_Returns401()
    {
        var client = fixture.Factory.CreateClient();
        var email = UniqueEmail();
        await client.PostAsJsonAsync("/auth/register", new RegisterRequest(email, "correct-horse"));

        var login = await client.PostAsJsonAsync(
            "/auth/login", new LoginRequest(email, "wrong-password"));

        Assert.Equal(HttpStatusCode.Unauthorized, login.StatusCode);
        Assert.Equal("wrong_password", await ErrorCode(login));
    }

    [Fact]
    public async Task PostAuthLogin_UnknownEmail_Returns401()
    {
        var login = await fixture.Factory.CreateClient().PostAsJsonAsync(
            "/auth/login", new LoginRequest(UniqueEmail(), "whatever1"));

        Assert.Equal(HttpStatusCode.Unauthorized, login.StatusCode);
        Assert.Equal("no_account", await ErrorCode(login));
    }

    [Fact]
    public async Task PostAuthLogin_GoogleAccountWithoutPassword_Returns401_GoogleAccount()
    {
        var googleClient = ClientWithGoogleStub();
        await googleClient.PostAsJsonAsync("/auth/google", new { idToken = "good-token" });

        var login = await fixture.Factory.CreateClient().PostAsJsonAsync(
            "/auth/login", new LoginRequest("someone@gmail.com", "whatever1"));

        Assert.Equal(HttpStatusCode.Unauthorized, login.StatusCode);
        Assert.Equal("google_account", await ErrorCode(login));
    }

    [Fact]
    public async Task PostAuthForgotPassword_UnknownEmail_GenericResponse_NoDebugToken()
    {
        var response = await fixture.Factory.CreateClient().PostAsJsonAsync(
            "/auth/forgot-password", new ForgotPasswordRequest(UniqueEmail()));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ForgotPasswordResponse>();
        Assert.Null(body!.DebugToken);
    }

    [Fact]
    public async Task PostAuthForgotPassword_SendsTheResetEmail_OncePerInterval()
    {
        var outbox = new CapturingEmailSender();
        var factory = fixture.Factory.WithWebHostBuilder(b => b.ConfigureTestServices(s =>
        {
            s.AddSingleton<IEmailSender>(outbox);
            s.AddSingleton(new ResetEmailThrottle());
        }));
        var client = factory.CreateClient();
        var email = UniqueEmail();
        await client.PostAsJsonAsync("/auth/register", new RegisterRequest(email, "correct-horse"));

        var first = await client.PostAsJsonAsync("/auth/forgot-password", new ForgotPasswordRequest(email));
        var link = (await first.Content.ReadFromJsonAsync<ForgotPasswordResponse>())!.DebugResetLink!;
        // Asked again right away (double tap): same generic answer, no second email.
        var second = await client.PostAsJsonAsync("/auth/forgot-password", new ForgotPasswordRequest(email));
        // No account: nothing sent either.
        await client.PostAsJsonAsync("/auth/forgot-password", new ForgotPasswordRequest(UniqueEmail()));

        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        var sent = Assert.Single(outbox.Sent);
        Assert.Equal(email, sent.To);
        Assert.Equal(PasswordResetEmail.Subject, sent.Subject);
        Assert.Contains(System.Net.WebUtility.HtmlEncode(link), sent.Html);
        Assert.Contains(link, sent.Text);
    }

    private sealed class CapturingEmailSender : IEmailSender
    {
        public List<(string To, string Subject, string Html, string Text)> Sent { get; } = [];

        public bool Enabled => true;

        public Task<bool> SendAsync(string to, string subject, string html, string text, CancellationToken ct)
        {
            lock (Sent)
            {
                Sent.Add((to, subject, html, text));
            }
            return Task.FromResult(true);
        }
    }

    [Fact]
    public async Task PostAuthForgotPassword_ThenReset_ChangesPasswordAndRevokesOldSessions()
    {
        var client = fixture.Factory.CreateClient();
        var email = UniqueEmail();
        var register = await client.PostAsJsonAsync(
            "/auth/register", new RegisterRequest(email, "old-password"));
        var oldSession = (await register.Content.ReadFromJsonAsync<SessionResponse>())!;

        var forgot = await client.PostAsJsonAsync(
            "/auth/forgot-password", new ForgotPasswordRequest(email));
        var forgotBody = await forgot.Content.ReadFromJsonAsync<ForgotPasswordResponse>();
        Assert.False(string.IsNullOrEmpty(forgotBody!.DebugToken)); // dev-only fallback

        var reset = await client.PostAsJsonAsync(
            "/auth/reset-password", new ResetPasswordRequest(forgotBody.DebugToken!, "new-password"));
        Assert.Equal(HttpStatusCode.OK, reset.StatusCode);

        // Old password no longer works, new one does.
        var loginOld = await client.PostAsJsonAsync(
            "/auth/login", new LoginRequest(email, "old-password"));
        Assert.Equal(HttpStatusCode.Unauthorized, loginOld.StatusCode);

        var loginNew = await client.PostAsJsonAsync(
            "/auth/login", new LoginRequest(email, "new-password"));
        Assert.Equal(HttpStatusCode.OK, loginNew.StatusCode);

        // The pre-reset session's refresh token was revoked.
        var oldRefresh = await client.PostAsJsonAsync(
            "/auth/refresh", new { refreshToken = oldSession.RefreshToken });
        Assert.Equal(HttpStatusCode.Unauthorized, oldRefresh.StatusCode);
    }

    [Fact]
    public async Task PostAuthResetPassword_InvalidToken_Returns400()
    {
        var response = await fixture.Factory.CreateClient().PostAsJsonAsync(
            "/auth/reset-password", new ResetPasswordRequest("not-a-real-token", "new-password"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task ResetLink_CheckBeforeUse_ThenSingleUse()
    {
        var client = fixture.Factory.CreateClient();
        var email = UniqueEmail();
        await client.PostAsJsonAsync("/auth/register", new RegisterRequest(email, "old-password"));
        var forgot = await client.PostAsJsonAsync("/auth/forgot-password", new ForgotPasswordRequest(email));
        var token = (await forgot.Content.ReadFromJsonAsync<ForgotPasswordResponse>())!.DebugToken!;

        // Checking doesn't use the link up, and says whose account it is.
        var check = await client.PostAsJsonAsync("/auth/reset-password/check", new ResetTokenCheckRequest(token));
        Assert.Equal(HttpStatusCode.OK, check.StatusCode);
        Assert.Equal(email, (await check.Content.ReadFromJsonAsync<ResetTokenCheckResponse>())!.Email);

        var reset = await client.PostAsJsonAsync(
            "/auth/reset-password", new ResetPasswordRequest(token, "new-password"));
        Assert.Equal(HttpStatusCode.OK, reset.StatusCode);

        // Same link again: dead, for both the check and the reset itself.
        var checkAgain = await client.PostAsJsonAsync("/auth/reset-password/check", new ResetTokenCheckRequest(token));
        Assert.Equal(HttpStatusCode.BadRequest, checkAgain.StatusCode);
        var resetAgain = await client.PostAsJsonAsync(
            "/auth/reset-password", new ResetPasswordRequest(token, "third-password"));
        Assert.Equal(HttpStatusCode.BadRequest, resetAgain.StatusCode);
        Assert.Equal("invalid_token", await ErrorCode(resetAgain));
    }

    [Fact]
    public async Task ResetLink_ForGoogleAccount_SetsAPassword()
    {
        // The supported way for a Google account to get a password: the reset
        // link proves the caller owns the email (unlike /auth/register).
        // Its own Google identity — the shared SampleIdentity must stay
        // password-less for the other tests.
        var email = UniqueEmail();
        var googleClient = ClientWithGoogleStub(new GoogleIdentity("google-sub-reset", email, "Reset User", null));
        await googleClient.PostAsJsonAsync("/auth/google", new { idToken = "good-token" });
        var client = fixture.Factory.CreateClient();

        var forgot = await client.PostAsJsonAsync(
            "/auth/forgot-password", new ForgotPasswordRequest(email));
        var token = (await forgot.Content.ReadFromJsonAsync<ForgotPasswordResponse>())!.DebugToken!;
        var reset = await client.PostAsJsonAsync(
            "/auth/reset-password", new ResetPasswordRequest(token, "google-user-pw"));
        Assert.Equal(HttpStatusCode.OK, reset.StatusCode);

        var login = await client.PostAsJsonAsync(
            "/auth/login", new LoginRequest(email, "google-user-pw"));
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
    }

    private static async Task<string?> ErrorCode(HttpResponseMessage response)
    {
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        return body.TryGetProperty("code", out var code) ? code.GetString() : null;
    }
}
