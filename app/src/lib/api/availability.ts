import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "./client";
import type { AvailabilityResponse, AvailabilitySlot } from "./types";

export type AvailabilitySort = "soonest" | "nearest" | "name" | "capacity";

interface AvailabilityFilters {
  /** null = "Cualquiera" — no type filter. */
  resourceTypeId: string | null;
  from: Date;
  to: Date;
  /** Free-text search over resource / location name. */
  q?: string;
  /** Minimum resource capacity (party-size filter). */
  minCapacity?: number;
  /** Ordering — "soonest" (default) keeps the historical behaviour. */
  sort?: AvailabilitySort;
  /** Device coordinates — only sent when sort is "nearest". */
  lat?: number;
  lng?: number;
}

function buildParams({
  resourceTypeId,
  from,
  to,
  q,
  minCapacity,
  sort,
  lat,
  lng,
}: AvailabilityFilters) {
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
  if (sort && sort !== "soonest") {
    params.set("sort", sort);
  }
  if (sort === "nearest" && lat != null && lng != null) {
    params.set("lat", String(lat));
    params.set("lng", String(lng));
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
  const { resourceTypeId, from, to, q, minCapacity, sort, lat, lng } = filters;
  const effectiveSort = sort ?? "soonest";
  const nearest = effectiveSort === "nearest" && lat != null && lng != null;

  const query = useQuery({
    queryKey: [
      "availability",
      resourceTypeId ?? "all",
      from.toISOString(),
      to.toISOString(),
      q?.trim() || null,
      minCapacity ?? null,
      effectiveSort,
      nearest ? lat : null,
      nearest ? lng : null,
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
