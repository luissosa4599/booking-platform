namespace BookingEngine.Api.Application.Auth;

/// <summary>
/// Resend (https://resend.com) configuration, bound from environment in
/// Program.cs. Empty <see cref="ApiKey"/> disables real sending — callers
/// degrade to logging + (in Development only) returning the raw token in the
/// response body, same fallback shape as the dev magic link.
/// </summary>
public class EmailOptions
{
    public string ApiKey { get; set; } = string.Empty;

    /// <summary>
    /// Resend's shared test sender, usable with zero setup but only deliverable
    /// to the Resend account's own signup address — fine for the dev/demo
    /// account, not for arbitrary real users. Verify a domain in Resend and set
    /// this to an address on it to lift that restriction.
    /// </summary>
    public string FromAddress { get; set; } = "Tempo <onboarding@resend.dev>";

    public bool Enabled => !string.IsNullOrWhiteSpace(ApiKey);
}
