using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using BookingEngine.Api.Application.Auth;

namespace BookingEngine.Api.Infrastructure.Calendar;

/// <summary>
/// The Google Calendar OAuth2 dance: exchange an auth code for a refresh token,
/// refresh it into an access token, and create an event. Separate from sign-in
/// (which is OIDC / id-token only). Disabled unless the web client id + secret
/// are configured.
/// </summary>
public class GoogleCalendarClient(HttpClient http, AuthOptions options, ILogger<GoogleCalendarClient> logger)
{
    private const string TokenUrl = "https://oauth2.googleapis.com/token";
    private const string RevokeUrl = "https://oauth2.googleapis.com/revoke";
    private const string EventsUrl =
        "https://www.googleapis.com/calendar/v3/calendars/primary/events";

    public bool Enabled => options.GoogleCalendarEnabled;

    /// <summary>
    /// Exchanges the PKCE auth code for tokens. Returns the refresh token, or
    /// null + a short reason on failure.
    /// </summary>
    public async Task<(string? RefreshToken, string? Error)> ExchangeCodeAsync(
        string code, string codeVerifier, string redirectUri, CancellationToken ct)
    {
        var form = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["client_id"] = options.GoogleWebClientId,
            ["client_secret"] = options.GoogleClientSecret,
            ["code"] = code,
            ["code_verifier"] = codeVerifier,
            ["redirect_uri"] = redirectUri,
            ["grant_type"] = "authorization_code",
        });

        try
        {
            using var resp = await http.PostAsync(TokenUrl, form, ct);
            var body = await resp.Content.ReadFromJsonAsync<TokenResponse>(cancellationToken: ct);
            if (!resp.IsSuccessStatusCode || body is null)
            {
                logger.LogWarning("Calendar code exchange failed: {Status} {Error}",
                    resp.StatusCode, body?.Error);
                return (null, body?.Error ?? "exchange_failed");
            }
            if (string.IsNullOrEmpty(body.RefreshToken))
            {
                // Google only returns a refresh token with access_type=offline +
                // prompt=consent, or on the first grant. The client must send both.
                return (null, "no_refresh_token");
            }
            return (body.RefreshToken, null);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Calendar code exchange threw");
            return (null, "exchange_error");
        }
    }

    /// <summary>Refresh token -> access token. Null if the refresh token is dead.</summary>
    public async Task<string?> RefreshAccessTokenAsync(string refreshToken, CancellationToken ct)
    {
        var form = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["client_id"] = options.GoogleWebClientId,
            ["client_secret"] = options.GoogleClientSecret,
            ["refresh_token"] = refreshToken,
            ["grant_type"] = "refresh_token",
        });

        try
        {
            using var resp = await http.PostAsync(TokenUrl, form, ct);
            if (!resp.IsSuccessStatusCode)
            {
                return null;
            }
            var body = await resp.Content.ReadFromJsonAsync<TokenResponse>(cancellationToken: ct);
            return body?.AccessToken;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Calendar token refresh threw");
            return null;
        }
    }

    /// <summary>Creates an event on the user's primary calendar. Returns its
    /// public link, or null on failure.</summary>
    public async Task<string?> CreateEventAsync(
        string accessToken,
        string summary,
        string? location,
        string? description,
        DateTimeOffset startsAt,
        DateTimeOffset endsAt,
        CancellationToken ct)
    {
        var payload = new EventRequest(
            summary,
            location,
            description,
            new EventTime(startsAt.ToString("o")),
            new EventTime(endsAt.ToString("o")));

        using var req = new HttpRequestMessage(HttpMethod.Post, EventsUrl)
        {
            Content = JsonContent.Create(payload),
        };
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        try
        {
            using var resp = await http.SendAsync(req, ct);
            if (!resp.IsSuccessStatusCode)
            {
                logger.LogWarning("Calendar event create failed: {Status}", resp.StatusCode);
                return null;
            }
            var body = await resp.Content.ReadFromJsonAsync<EventResponse>(cancellationToken: ct);
            return body?.HtmlLink;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Calendar event create threw");
            return null;
        }
    }

    public async Task RevokeAsync(string refreshToken, CancellationToken ct)
    {
        try
        {
            var form = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["token"] = refreshToken,
            });
            using var _ = await http.PostAsync(RevokeUrl, form, ct);
        }
        catch
        {
            // best-effort
        }
    }

    private record TokenResponse(
        [property: JsonPropertyName("access_token")] string? AccessToken,
        [property: JsonPropertyName("refresh_token")] string? RefreshToken,
        [property: JsonPropertyName("error")] string? Error);

    private record EventRequest(
        [property: JsonPropertyName("summary")] string Summary,
        [property: JsonPropertyName("location")] string? Location,
        [property: JsonPropertyName("description")] string? Description,
        [property: JsonPropertyName("start")] EventTime Start,
        [property: JsonPropertyName("end")] EventTime End);

    private record EventTime([property: JsonPropertyName("dateTime")] string DateTime);

    private record EventResponse([property: JsonPropertyName("htmlLink")] string? HtmlLink);
}
