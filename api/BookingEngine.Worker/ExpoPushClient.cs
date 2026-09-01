using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace BookingEngine.Worker;

/// <summary>
/// Talks to Expo's push API directly over HTTP — no SDK dependency, it's one
/// endpoint. See https://docs.expo.dev/push-notifications/sending-notifications/
/// </summary>
public class ExpoPushClient(HttpClient httpClient, ILogger<ExpoPushClient> logger)
{
    private const string SendUrl = "https://exp.host/--/api/v2/push/send";

    /// <summary>
    /// Sends one push to one token. Returns false (and logs) on any failure —
    /// callers treat push delivery as best-effort, never worth retrying
    /// forever or crashing the poll loop over.
    /// </summary>
    public async Task<PushOutcome> SendAsync(
        string expoPushToken,
        string title,
        string body,
        CancellationToken ct = default)
    {
        var message = new ExpoPushMessage(expoPushToken, title, body);

        try
        {
            var response = await httpClient.PostAsJsonAsync(SendUrl, new[] { message }, ct);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning(
                    "Expo push API returned {Status} for token {Token}",
                    response.StatusCode,
                    Redact(expoPushToken));
                return PushOutcome.TransientFailure;
            }

            var result = await response.Content.ReadFromJsonAsync<ExpoPushResponse>(cancellationToken: ct);
            var ticket = result?.Data?.FirstOrDefault();

            if (ticket is null)
            {
                logger.LogWarning("Expo push API returned no ticket for token {Token}", Redact(expoPushToken));
                return PushOutcome.TransientFailure;
            }

            if (ticket.Status == "ok")
            {
                return PushOutcome.Sent;
            }

            // "DeviceNotRegistered" means the token is permanently dead (app
            // uninstalled, etc.) — the caller should stop using it. Any other
            // error is treated as transient (rate limit, malformed message).
            logger.LogWarning(
                "Expo push failed for token {Token}: {ErrorCode} {Message}",
                Redact(expoPushToken),
                ticket.Details?.Error,
                ticket.Message);

            return ticket.Details?.Error == "DeviceNotRegistered"
                ? PushOutcome.TokenInvalid
                : PushOutcome.TransientFailure;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Expo push request threw for token {Token}", Redact(expoPushToken));
            return PushOutcome.TransientFailure;
        }
    }

    private static string Redact(string token) =>
        token.Length <= 12 ? token : $"{token[..8]}...{token[^4..]}";

    private record ExpoPushMessage(string To, string Title, string Body);

    private record ExpoPushResponse([property: JsonPropertyName("data")] List<ExpoPushTicket>? Data);

    private record ExpoPushTicket(
        string Status,
        string? Message,
        [property: JsonPropertyName("details")] ExpoPushTicketDetails? Details);

    private record ExpoPushTicketDetails(string? Error);
}

public enum PushOutcome
{
    Sent,
    TokenInvalid,
    TransientFailure,
}
