import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "./client";
import type { AvailabilitySlot } from "./types";

interface AvailabilityFilters {
  /** null = "Cualquiera" — no type filter. */
  resourceTypeId: string | null;
  from: Date;
  to: Date;
}

export function useAvailability({ resourceTypeId, from, to }: AvailabilityFilters) {
  return useQuery({
    queryKey: ["availability", resourceTypeId ?? "all", from.toISOString(), to.toISOString()],
    queryFn: () => {
      const params = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
      });
      if (resourceTypeId) {
        params.set("resourceTypeId", resourceTypeId);
      }
      return apiFetch<AvailabilitySlot[]>(`/availability?${params.toString()}`);
    },
    // Handoff: "Disponibilidad en caché con TTL de 60 s". Returning to the
    // screen serves cache and revalidates in the background.
    staleTime: 60_000,
  });
}
