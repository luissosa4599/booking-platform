namespace BookingEngine.Api.Application.Auth;

public record RequestLinkRequest(string Email);

/// <summary>
/// In a real system the token would only be emailed. This is a portfolio stub:
/// there is no mail sender, so the dev response hands the token (and a ready
/// magic link) straight back to the caller.
/// </summary>
public record RequestLinkResponse(string Token, string MagicLink);

public record VerifyRequest(string Token);

public record VerifyResponse(string UserId, string Email);
