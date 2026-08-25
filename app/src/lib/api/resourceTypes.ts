import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "./client";
import type { ResourceType } from "./types";

export function useResourceTypes() {
  return useQuery({
    queryKey: ["resource-types"],
    queryFn: () => apiFetch<ResourceType[]>("/resource-types"),
    // Resource types are near-static config, not live availability data.
    staleTime: 5 * 60_000,
  });
}
