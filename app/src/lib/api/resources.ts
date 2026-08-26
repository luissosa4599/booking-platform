import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "./client";
import type { ResourceDetail } from "./types";

export function useResource(id: string | undefined) {
  return useQuery({
    queryKey: ["resource", id],
    queryFn: () => apiFetch<ResourceDetail>(`/resources/${id}`),
    enabled: !!id,
    // Same reasoning as availability: fine to serve slightly-stale slot data
    // while revalidating in the background rather than refetching every mount.
    staleTime: 60_000,
  });
}
