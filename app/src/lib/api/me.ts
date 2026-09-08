import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "./client";
import type { Me } from "./types";

// `userId` scopes the cache so a re-login as a different account doesn't show
// stale counters — the request itself is authenticated by the bearer token.
export function useMe(userId: string) {
  return useQuery({
    queryKey: ["me", userId],
    enabled: userId !== "",
    queryFn: () => apiFetch<Me>("/me"),
    staleTime: 5 * 60_000,
  });
}
