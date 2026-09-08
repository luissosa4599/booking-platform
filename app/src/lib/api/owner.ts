import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "./client";
import type {
  CreateSpaceInput,
  OwnerSpaceDetail,
  OwnerSpaceSummary,
  SetScheduleInput,
  UpdateSpaceInput,
} from "./types";

export function useOwnerSpaces(userId: string) {
  return useQuery({
    queryKey: ["owner", "spaces", userId],
    enabled: userId !== "",
    queryFn: () => apiFetch<OwnerSpaceSummary[]>("/owner/spaces"),
  });
}

export function useOwnerSpace(id: string, userId: string) {
  return useQuery({
    queryKey: ["owner", "space", id, userId],
    enabled: id !== "" && userId !== "",
    queryFn: () => apiFetch<OwnerSpaceDetail>(`/owner/spaces/${id}`),
  });
}

function useOwnerInvalidation() {
  const queryClient = useQueryClient();
  return (spaceId?: string) => {
    queryClient.invalidateQueries({ queryKey: ["owner"] });
    queryClient.invalidateQueries({ queryKey: ["availability"] });
    if (spaceId) {
      queryClient.invalidateQueries({ queryKey: ["resource", spaceId] });
    }
  };
}

export function useCreateSpace() {
  const invalidate = useOwnerInvalidation();
  return useMutation({
    mutationFn: (input: CreateSpaceInput) =>
      apiFetch<OwnerSpaceDetail>("/owner/spaces", { method: "POST", body: input }),
    onSuccess: (space) => invalidate(space.id),
  });
}

export function useUpdateSpace(id: string) {
  const invalidate = useOwnerInvalidation();
  return useMutation({
    mutationFn: (input: UpdateSpaceInput) =>
      apiFetch<OwnerSpaceDetail>(`/owner/spaces/${id}`, { method: "PATCH", body: input }),
    onSuccess: () => invalidate(id),
  });
}

export function useSetSchedule(id: string) {
  const invalidate = useOwnerInvalidation();
  return useMutation({
    mutationFn: (input: SetScheduleInput) =>
      apiFetch<OwnerSpaceDetail>(`/owner/spaces/${id}/schedule`, { method: "PUT", body: input }),
    onSuccess: () => invalidate(id),
  });
}
