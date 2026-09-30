/**
 * "How long until it starts", for status badges and the booking pane.
 *
 * Under an hour stays in plain minutes ("45 min"); an hour or more switches to
 * HH:mm + "h" ("12:00 h") — 2026-09-30 report: at night Explore's cards read
 * "Libre en 720 min". The trailing "h" keeps it from reading as a clock time.
 */
export function formatDuration(totalMinutes: number): string {
  const mins = Math.max(0, Math.round(totalMinutes));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} h`;
}

/** Minutes from `now` until `iso`, never negative. */
export function minutesUntil(iso: string, now: Date = new Date()): number {
  return Math.max(0, Math.round((new Date(iso).getTime() - now.getTime()) / 60_000));
}
