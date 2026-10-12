using BookingEngine.Api.Application.Auth;
using MailKit.Security;
using MimeKit;

namespace BookingEngine.Api.Infrastructure.Email;

/// <summary>
/// SMTP via MailKit (System.Net.Mail.SmtpClient is marked obsolete for new
/// code and has no modern TLS/auth story). One connection per message — this
/// only ever sends the odd password-reset email, pooling isn't worth it.
/// Disabled (Enabled=false) until SMTP_HOST/USERNAME/PASSWORD are set.
/// </summary>
public class SmtpEmailSender(EmailOptions options, ILogger<SmtpEmailSender> logger) : IEmailSender
{
    // Under the app's 15 s timeout on auth calls, so a slow SMTP server ends
    // as "we sent it if the account exists" instead of a client-side error.
    private const int TimeoutMs = 10_000;

    public bool Enabled => options.Enabled;

    public async Task<bool> SendAsync(string to, string subject, string html, string text, CancellationToken ct)
    {
        if (!Enabled)
        {
            return false;
        }

        try
        {
            var message = new MimeMessage();
            message.From.Add(MailboxAddress.Parse(options.EffectiveFrom));
            message.To.Add(MailboxAddress.Parse(to));
            message.Subject = subject;
            message.Body = new BodyBuilder { HtmlBody = html, TextBody = text }.ToMessageBody();

            using var client = new MailKit.Net.Smtp.SmtpClient { Timeout = TimeoutMs };
            var security = options.SmtpPort == 465
                ? SecureSocketOptions.SslOnConnect
                : SecureSocketOptions.StartTls;
            await client.ConnectAsync(options.SmtpHost, options.SmtpPort, security, ct);
            await client.AuthenticateAsync(options.SmtpUsername, options.SmtpPassword, ct);
            await client.SendAsync(message, ct);
            await client.DisconnectAsync(true, ct);
            return true;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "SMTP send to {Host}:{Port} failed", options.SmtpHost, options.SmtpPort);
            return false;
        }
    }
}
