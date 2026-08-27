import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "./client";
import type { AvailabilityResponse, AvailabilitySlot } from "./types";

interface AvailabilityFilters {
  /** null = "Cualquiera" — no type filter. */
  resourceTypeId: string | null;
  from: Date;
  to: Date;
  /** Free-text search over resource / location name. */
  q?: string;
  /** Minimum resource capacity (party-size filter). */
  minCapacity?: number;
}

function buildParams({ resourceTypeId, from, to, q, minCapacity }: AvailabilityFilters) {
  const params = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
  });
  if (resourceTypeId) {
    params.set("resourceTypeId", resourceTypeId);
  }
  if (q && q.trim()) {
    params.set("q", q.trim());
  }
  if (minCapacity && minCapacity > 0) {
    params.set("minCapacity", String(minCapacity));
  }
  return params;
}

/**
 * GET /availability. The backend returns an envelope
 * (`{ slots, emptyContext }`); this hook keeps the raw response as `data` so
 * callers can read `emptyContext` for the dynamic empty state, and exposes
 * `slots` as a convenience for the common case.
 */
export function useAvailability(filters: AvailabilityFilters) {
  const { resourceTypeId, from, to, q, minCapacity } = filters;

  const query = useQuery({
    queryKey: [
      "availability",
      resourceTypeId ?? "all",
      from.toISOString(),
      to.toISOString(),
      q?.trim() || null,
      minCapacity ?? null,
    ],
    queryFn: () =>
      apiFetch<AvailabilityResponse>(`/availability?${buildParams(filters).toString()}`),
    // Handoff: "Disponibilidad en caché con TTL de 60 s". Returning to the
    // screen serves cache and revalidates in the background.
    staleTime: 60_000,
  });

  const slots: AvailabilitySlot[] = query.data?.slots ?? [];
  const emptyContext = query.data?.emptyContext ?? null;

  return { ...query, slots, emptyContext };
}
