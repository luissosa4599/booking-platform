namespace BookingEngine.Api.Application.Auth;

/// <summary>
/// Outgoing mail over plain SMTP, bound from environment in Program.cs. Today
/// that's the owner's own Gmail (smtp.gmail.com:587 + an app password — ~500
/// messages/day, plenty for password resets); moving to a transactional
/// provider later (smtp.resend.com, SES, ...) is config only. Any of host /
/// username / password empty disables real sending — callers degrade to
/// logging + (in Development only) returning the raw token in the response
/// body, same fallback shape as the dev magic link.
/// </summary>
public class EmailOptions
{
    public string SmtpHost { get; set; } = string.Empty;

    /// <summary>587 = STARTTLS, 465 = TLS from the first byte.</summary>
    public int SmtpPort { get; set; } = 587;

    public string SmtpUsername { get; set; } = string.Empty;

    public string SmtpPassword { get; set; } = string.Empty;

    /// <summary>
    /// "Name &lt;address&gt;". Empty -> "Tempo &lt;SmtpUsername&gt;". Gmail
    /// rewrites any other address to the authenticated account anyway.
    /// </summary>
    public string FromAddress { get; set; } = string.Empty;

    public bool Enabled =>
        !string.IsNullOrWhiteSpace(SmtpHost) &&
        !string.IsNullOrWhiteSpace(SmtpUsername) &&
        !string.IsNullOrWhiteSpace(SmtpPassword);

    public string EffectiveFrom =>
        string.IsNullOrWhiteSpace(FromAddress) ? $"Tempo <{SmtpUsername}>" : FromAddress;
}
