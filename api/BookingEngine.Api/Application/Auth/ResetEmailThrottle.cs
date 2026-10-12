namespace BookingEngine.Api.Application.Auth;

/// <summary>
/// Caps password-reset mail, which goes out through the owner's personal
/// Gmail (~500 messages/day before Google starts refusing, and a spam report
/// lands on that account): per address, one message every
/// <see cref="MinInterval"/> and <see cref="PerAddressPerDay"/> a day; overall,
/// <see cref="TotalPerDay"/>. The global per-IP rate limiter doesn't cover this
/// — one client can name a different victim address on every request.
///
/// In memory, per instance: Cloud Run runs at most 2 and scales to zero, so the
/// real ceiling is up to 2x these numbers and a cold start forgets everything.
/// Good enough for a demo-scale app; a DB-backed log is the upgrade path.
/// A throttled request still gets the generic "we sent it" response.
/// </summary>
public class ResetEmailThrottle
{
    // Under the reset screen's 45 s resend cooldown, so a real "resend" tap
    // always goes through.
    public static readonly TimeSpan MinInterval = TimeSpan.FromSeconds(40);
    public const int PerAddressPerDay = 5;
    public const int TotalPerDay = 300;

    private static readonly TimeSpan Window = TimeSpan.FromDays(1);

    private readonly object _gate = new();
    private readonly Dictionary<string, List<DateTimeOffset>> _byAddress = new();
    private readonly Queue<DateTimeOffset> _all = new();

    public bool TryAcquire(string email, DateTimeOffset now)
    {
        var cutoff = now - Window;
        lock (_gate)
        {
            while (_all.Count > 0 && _all.Peek() <= cutoff)
            {
                _all.Dequeue();
            }
            if (_all.Count >= TotalPerDay)
            {
                return false;
            }

            if (_byAddress.TryGetValue(email, out var sends))
            {
                sends.RemoveAll(t => t <= cutoff);
                if (sends.Count >= PerAddressPerDay ||
                    (sends.Count > 0 && now - sends[^1] < MinInterval))
                {
                    return false;
                }
            }
            else
            {
                // Entries only exist for addresses that got a message in the
                // last day (<= TotalPerDay of them) plus stale ones; sweep the
                // stale ones before the map can grow past that.
                if (_byAddress.Count >= TotalPerDay)
                {
                    foreach (var key in _byAddress.Where(kv => kv.Value[^1] <= cutoff).Select(kv => kv.Key).ToList())
                    {
                        _byAddress.Remove(key);
                    }
                }
                sends = [];
                _byAddress[email] = sends;
            }

            sends.Add(now);
            _all.Enqueue(now);
            return true;
        }
    }
}
