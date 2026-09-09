import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useUserId } from "@/lib/session";
import { apiFetch } from "./client";

/** A favorited resource, flattened enough to render Explore rows / the profile
 * list without a second fetch. Mirrors the API's `FavoriteResourceResponse`. */
export interface FavoriteResource {
  resourceId: string;
  name: string;
  locationName: string;
  locationAddress: string | null;
  resourceTypeId: string;
}

// `userId` only scopes the cache — the request is authenticated by the bearer
// token, and the server derives identity from it.
export function useFavorites() {
  const userId = useUserId();
  const query = useQuery({
    queryKey: ["favorites", userId],
    enabled: userId !== "",
    queryFn: () => apiFetch<FavoriteResource[]>("/favorites"),
    staleTime: 60_000,
  });

  const ids = useMemo(
    () => new Set((query.data ?? []).map((f) => f.resourceId)),
    [query.data],
  );

  return { ...query, favorites: query.data ?? [], ids };
}

interface ToggleInput {
  resourceId: string;
  next: boolean;
  /** Built by the caller from the resource/slot in hand — lets the optimistic
   * update populate the profile list without waiting on a refetch. */
  summary?: FavoriteResource;
}

export function useToggleFavorite() {
  const qc = useQueryClient();
  const userId = useUserId();
  const key = ["favorites", userId] as const;

  return useMutation({
    mutationFn: ({ resourceId, next }: ToggleInput) =>
      next
        ? apiFetch<void>("/favorites", {
            method: "POST",
            body: { resourceId },
          })
        : apiFetch<void>(`/favorites/${resourceId}`, { method: "DELETE" }),
    onMutate: async ({ resourceId, next, summary }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<FavoriteResource[]>(key) ?? [];
      const without = prev.filter((f) => f.resourceId !== resourceId);
      qc.setQueryData<FavoriteResource[]>(
        key,
        next ? [...(summary ? [summary] : []), ...without] : without,
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}
