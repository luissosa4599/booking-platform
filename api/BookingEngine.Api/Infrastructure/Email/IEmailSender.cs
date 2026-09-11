namespace BookingEngine.Api.Infrastructure.Email;

public interface IEmailSender
{
    bool Enabled { get; }

    /// <summary>Best-effort send — returns false (never throws) on any failure;
    /// the caller logs and degrades, same pattern as <c>IImageStorage</c>.</summary>
    Task<bool> SendAsync(string to, string subject, string html, CancellationToken ct);
}
