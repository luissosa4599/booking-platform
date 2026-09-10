namespace BookingEngine.Api.Application.Availability;

/// <summary>
/// GET /availability envelope. <see cref="EmptyContext"/> is populated only
/// when <see cref="Slots"/> is empty, giving the client enough to compose a
/// useful empty state ("Semana de parciales. Mañana a las 9:30 hay tres
/// libres.") instead of a generic "nothing found". See design-handoff screen 06.
/// </summary>
public record AvailabilityResponse(
    IReadOnlyList<AvailabilitySlotResponse> Slots,
    EmptyContextResponse? EmptyContext);

/// <param name="Reason">noAvailability | noResults | filtered</param>
/// <param name="NextAvailableAt">Earliest slot with capacity beyond the queried window / filters, if any.</param>
/// <param name="BlockingFilter">Human label of the most restrictive active filter, if any.</param>
/// <param name="OccupancyNote">Optional one-line context about why the window is empty.</param>
public record EmptyContextResponse(
    string Reason,
    DateTimeOffset? NextAvailableAt,
    string? BlockingFilter,
    string? OccupancyNote);
