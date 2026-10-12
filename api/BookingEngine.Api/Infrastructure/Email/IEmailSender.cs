namespace BookingEngine.Api.Infrastructure.Email;

public interface IEmailSender
{
    bool Enabled { get; }

    /// <summary>Best-effort send — returns false (never throws) on any failure;
    /// the caller logs and degrades, same pattern as <c>IImageStorage</c>.
    /// <paramref name="text"/> is the plain-text alternative part.</summary>
    Task<bool> SendAsync(string to, string subject, string html, string text, CancellationToken ct);
}
