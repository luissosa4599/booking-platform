using System.Net;
using System.Reflection;
using BookingEngine.Api.Application.Auth;

namespace BookingEngine.Api.Infrastructure.Email;

/// <summary>
/// The password-reset email from the sign-in handoff ("Dos puertas",
/// email.html / email.txt). The copy lives in Templates/ as embedded UTF-8
/// resources, not C# string literals: .cs files here compile as CP1252 (see
/// CLAUDE.md, "ASCII-only"), and this is Spanish prose full of accents.
/// </summary>
public static class PasswordResetEmail
{
    // "Crea tu nueva contraseña" — \u escape, same ASCII-source rule.
    public const string Subject = "Crea tu nueva contrase\u00f1a";

    private static readonly Lazy<string> HtmlTemplate = new(() => Load("password-reset.html"));
    private static readonly Lazy<string> TextTemplate = new(() => Load("password-reset.txt"));

    /// <param name="frontendUrl">The web app's origin — hosts both the reset
    /// page the link opens and the logo image (app/public/email/).</param>
    public static (string Html, string Text) Render(string link, string frontendUrl)
    {
        var minutes = ((int)PasswordResetTokens.Lifetime.TotalMinutes).ToString();
        var logoUrl = $"{frontendUrl.TrimEnd('/')}/email/logo-email.png";

        var html = HtmlTemplate.Value
            .Replace("{{link}}", WebUtility.HtmlEncode(link))
            .Replace("{{logoUrl}}", WebUtility.HtmlEncode(logoUrl))
            .Replace("{{minutos}}", minutes);
        var text = TextTemplate.Value
            .Replace("{{link}}", link)
            .Replace("{{minutos}}", minutes);
        return (html, text);
    }

    private static string Load(string name)
    {
        using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream($"EmailTemplates.{name}")
            ?? throw new InvalidOperationException($"Missing embedded email template {name}");
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }
}
