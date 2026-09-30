import { formatDuration, minutesUntil } from "../countdown";

describe("formatDuration", () => {
  it("keeps plain minutes under an hour", () => {
    expect(formatDuration(0)).toBe("0 min");
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(59)).toBe("59 min");
  });

  it("switches to HH:mm h from one hour on", () => {
    expect(formatDuration(60)).toBe("01:00 h");
    expect(formatDuration(90)).toBe("01:30 h");
    expect(formatDuration(720)).toBe("12:00 h");
    expect(formatDuration(745)).toBe("12:25 h");
  });

  it("never goes negative", () => {
    expect(formatDuration(-10)).toBe("0 min");
  });
});

describe("minutesUntil", () => {
  it("rounds to whole minutes from the given now", () => {
    const now = new Date("2026-09-30T02:00:00Z");
    expect(minutesUntil("2026-09-30T14:00:00Z", now)).toBe(720);
    expect(minutesUntil("2026-09-30T01:00:00Z", now)).toBe(0);
  });
});
