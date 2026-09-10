/** Shared API helpers for the e2e suite — talk to the real dev API directly. */

export const API_URL = process.env.E2E_API_URL ?? "http://localhost:5190";

export interface DevSession {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    role?: string | null;
    displayName?: string | null;
  };
}

/** Dev magic-link flow, server-side: request a link, redeem its token. */
export async function devSession(email: string): Promise<DevSession> {
  const link = await fetch(`${API_URL}/auth/request-link`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!link.ok) throw new Error(`request-link ${link.status}`);
  const { token } = (await link.json()) as { token: string };

  const verify = await fetch(`${API_URL}/auth/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (!verify.ok) throw new Error(`verify ${verify.status}`);
  return (await verify.json()) as DevSession;
}

/** The exact string `lib/session.ts` persists at `tempo.session.v1`. */
export function sessionStorageValue(s: DevSession): string {
  return JSON.stringify({
    userId: s.user.id,
    email: s.user.email,
    displayName: s.user.displayName ?? null,
    avatarUrl: null,
    role: s.user.role === "host" ? "host" : "guest",
    accessToken: s.accessToken,
    refreshToken: s.refreshToken,
  });
}

export async function seed(): Promise<void> {
  const r = await fetch(`${API_URL}/dev/seed`, { method: "POST" });
  if (!r.ok) throw new Error(`dev/seed ${r.status}`);
}

export interface Slot {
  id: string;
  resourceId: string;
  resourceName: string;
  startsAt: string;
  endsAt: string;
  capacityRemaining: number;
  rowVersion: number;
}

export async function availability(
  token: string,
  opts: { from?: Date; to?: Date } = {},
): Promise<Slot[]> {
  const from = (opts.from ?? new Date()).toISOString();
  const to = (opts.to ?? new Date(Date.now() + 7 * 86_400_000)).toISOString();
  const r = await fetch(
    `${API_URL}/availability?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  if (!r.ok) throw new Error(`availability ${r.status}`);
  const body = (await r.json()) as { slots?: Slot[] } | Slot[];
  return Array.isArray(body) ? body : (body.slots ?? []);
}

/**
 * A random slot matching the filter — random so parallel tests sharing the
 * one seeded dataset don't all fight over slot[0].
 */
export function pickSlot(
  slots: Slot[],
  opts: { minCapacity?: number; withinMinutes?: number } = {},
): Slot {
  const { minCapacity = 1, withinMinutes } = opts;
  const cutoff = withinMinutes
    ? Date.now() + withinMinutes * 60_000
    : Infinity;
  const pool = slots.filter(
    (s) =>
      s.capacityRemaining >= minCapacity &&
      new Date(s.startsAt).getTime() <= cutoff,
  );
  if (pool.length === 0) throw new Error("no slot matches the filter");
  return pool[Math.floor(Math.random() * pool.length)]!;
}

export async function createBooking(
  token: string,
  slotId: string,
  seats = 1,
): Promise<{ id: string; code: string }> {
  const r = await fetch(`${API_URL}/bookings`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "idempotency-key": `e2e-${slotId}-${Date.now()}-${Math.random()}`,
    },
    body: JSON.stringify({ availabilitySlotId: slotId, seats }),
  });
  if (!r.ok) throw new Error(`createBooking ${r.status} ${await r.text()}`);
  return (await r.json()) as { id: string; code: string };
}
