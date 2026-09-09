import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, apiFetch } from "./client";
import type {
  CreateSpaceInput,
  OwnerSpaceDetail,
  OwnerSpaceSummary,
  ResourceImage,
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

export function useAddSlot(id: string) {
  const invalidate = useOwnerInvalidation();
  return useMutation({
    mutationFn: (input: { startsAt: string; endsAt: string; capacity: number }) =>
      apiFetch<OwnerSpaceDetail>(`/owner/spaces/${id}/slots`, { method: "POST", body: input }),
    onSuccess: () => invalidate(id),
  });
}

export function useDeleteSlot(id: string) {
  const invalidate = useOwnerInvalidation();
  return useMutation({
    mutationFn: (slotId: string) =>
      apiFetch<void>(`/owner/spaces/${id}/slots/${slotId}`, { method: "DELETE" }),
    onSuccess: () => invalidate(id),
  });
}

export function useBlockSlot(id: string) {
  const invalidate = useOwnerInvalidation();
  const mutation = useMutation({
    mutationFn: (input: { slotId: string; force?: boolean }) =>
      apiFetch<void>(`/owner/spaces/${id}/slots/${input.slotId}/block`, {
        method: "POST",
        body: { force: input.force ?? false },
      }),
    onSuccess: () => invalidate(id),
  });
  // A 409 carries { bookings: N } — the count to confirm before force-blocking.
  const conflictBookings =
    mutation.error instanceof ApiError && mutation.error.status === 409
      ? ((mutation.error.body as { bookings?: number }).bookings ?? 0)
      : null;
  return { ...mutation, conflictBookings };
}

export function useUnblockSlot(id: string) {
  const invalidate = useOwnerInvalidation();
  return useMutation({
    mutationFn: (slotId: string) =>
      apiFetch<void>(`/owner/spaces/${id}/slots/${slotId}/unblock`, { method: "POST" }),
    onSuccess: () => invalidate(id),
  });
}

// --- Photos (PR3b) --------------------------------------------------------

interface UploadUrlResponse {
  uploadUrl: string;
  publicUrl: string;
}

export function useCreateImageUploadUrl(id: string) {
  return useMutation({
    mutationFn: (contentType: string) =>
      apiFetch<UploadUrlResponse>(`/owner/spaces/${id}/images/upload-url`, {
        method: "POST",
        body: { contentType },
      }),
  });
}

export function useAddSpaceImage(id: string) {
  const invalidate = useOwnerInvalidation();
  return useMutation({
    mutationFn: (url: string) =>
      apiFetch<ResourceImage[]>(`/owner/spaces/${id}/images`, {
        method: "POST",
        body: { url },
      }),
    onSuccess: () => invalidate(id),
  });
}

export function useDeleteSpaceImage(id: string) {
  const invalidate = useOwnerInvalidation();
  return useMutation({
    mutationFn: (imageId: string) =>
      apiFetch<ResourceImage[]>(`/owner/spaces/${id}/images/${imageId}`, {
        method: "DELETE",
      }),
    onSuccess: () => invalidate(id),
  });
}

export function useReorderSpaceImages(id: string) {
  const invalidate = useOwnerInvalidation();
  return useMutation({
    mutationFn: (imageIds: string[]) =>
      apiFetch<ResourceImage[]>(`/owner/spaces/${id}/images/order`, {
        method: "PUT",
        body: { imageIds },
      }),
    onSuccess: () => invalidate(id),
  });
}
