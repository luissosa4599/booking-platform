using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using BookingEngine.Api.Application.Auth;

namespace BookingEngine.Api.Infrastructure.Email;

/// <summary>
/// Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email)
/// — a single POST, no SDK dependency (same "typed HttpClient, hand-rolled"
/// approach as <c>GoogleCalendarClient</c>/<c>GeocodingClient</c>). Disabled
/// (Enabled=false) until RESEND_API_KEY is configured; callers degrade to
/// logging + a dev-only debug token in the response, mirroring the dev magic
/// link's own no-mail-sender fallback.
/// </summary>
public class ResendEmailClient(HttpClient http, EmailOptions options, ILogger<ResendEmailClient> logger)
    : IEmailSender
{
    private const string SendUrl = "https://api.resend.com/emails";

    public bool Enabled => options.Enabled;

    public async Task<bool> SendAsync(string to, string subject, string html, CancellationToken ct)
    {
        if (!Enabled)
        {
            return false;
        }

        using var req = new HttpRequestMessage(HttpMethod.Post, SendUrl)
        {
            Content = JsonContent.Create(new SendRequest(options.FromAddress, [to], subject, html)),
        };
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", options.ApiKey);

        try
        {
            using var resp = await http.SendAsync(req, ct);
            if (!resp.IsSuccessStatusCode)
            {
                var body = await resp.Content.ReadAsStringAsync(ct);
                logger.LogWarning("Resend send failed: {Status} {Body}", resp.StatusCode, body);
                return false;
            }
            return true;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Resend send threw");
            return false;
        }
    }

    private record SendRequest(
        [property: JsonPropertyName("from")] string From,
        [property: JsonPropertyName("to")] string[] To,
        [property: JsonPropertyName("subject")] string Subject,
        [property: JsonPropertyName("html")] string Html);
}
