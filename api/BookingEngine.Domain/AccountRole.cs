namespace BookingEngine.Domain;

/// <summary>
/// Which side of the marketplace an account is on. Every account starts a
/// <see cref="Guest"/> (books spaces) and can self-upgrade to <see cref="Host"/>
/// (publishes spaces, sets schedules, scans booking QR codes) with no approval —
/// see <c>POST /me/become-host</c>. Stored as a string on <see cref="User"/> and
/// mirrored into the access token as the <c>role</c> claim (the "Host" auth
/// policy checks that claim).
/// </summary>
public enum AccountRole
{
    Guest,
    Host,
}
