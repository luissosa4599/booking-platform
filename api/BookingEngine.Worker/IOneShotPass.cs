namespace BookingEngine.Worker;

/// <summary>
/// A worker sweep that can run exactly once and return, instead of looping on a
/// <see cref="System.Threading.PeriodicTimer"/>. The long-running services
/// (<see cref="ReminderService"/> etc.) implement this so the same code can be
/// driven two ways: as an always-on <c>BackgroundService</c> for local
/// <c>docker compose</c>, or as a one-shot invocation (<c>--oneshot</c>) that a
/// scheduler triggers on an interval — the deployed shape, so nothing has to
/// stay running (and billing) between sweeps. See Program.cs.
/// </summary>
public interface IOneShotPass
{
    Task RunOnceAsync(CancellationToken ct);
}
