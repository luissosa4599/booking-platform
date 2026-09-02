import { composeEmptyStateCopy } from "../emptyStateCopy";

describe("composeEmptyStateCopy", () => {
  it("falls back to a generic message with no context", () => {
    const { title, body } = composeEmptyStateCopy(null);
    expect(title).toBe("Nada libre por ahora");
    expect(body).toMatch(/disponibles/);
  });

  it("names the search term for noResults", () => {
    const copy = composeEmptyStateCopy({
      reason: "noResults",
      nextAvailableAt: null,
      blockingFilter: "boreal",
      occupancyNote: null,
    });
    expect(copy.title).toBe("Sin coincidencias");
    expect(copy.body).toContain("boreal");
  });

  it("surfaces the next-available datum for a filtered window", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 30, 0, 0);

    const copy = composeEmptyStateCopy({
      reason: "filtered",
      nextAvailableAt: tomorrow.toISOString(),
      blockingFilter: "salas",
      occupancyNote: null,
    });
    expect(copy.body).toMatch(/Mañana a las/);
  });

  it("combines the occupancy note and next-available for noAvailability", () => {
    // Noon today, not `now + 3h`: the latter crosses midnight — and flips
    // "Hoy" → "Mañana" — whenever CI (UTC) runs after ~21:00.
    const later = new Date();
    later.setHours(12, 0, 0, 0);

    const copy = composeEmptyStateCopy({
      reason: "noAvailability",
      nextAvailableAt: later.toISOString(),
      blockingFilter: null,
      occupancyNote: "6 espacios llenos en este horario.",
    });
    expect(copy.body).toContain("6 espacios llenos");
    expect(copy.body).toMatch(/Hoy a las/);
  });
});
