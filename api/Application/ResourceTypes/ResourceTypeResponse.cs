namespace BookingEngine.Api.Application.ResourceTypes;

public record ResourceLabelsResponse(
    string Singular,
    string Plural,
    string CapacityUnit,
    string ActionVerb);

public record ResourceTypeResponse(
    Guid Id,
    string Name,
    ResourceLabelsResponse Labels,
    bool AllowsMultipleSeats,
    bool AllowsWaitlist);
