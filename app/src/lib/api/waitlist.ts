import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "./client";
import type { WaitlistEntry, WaitlistEntryDetail } from "./types";

interface JoinWaitlistInput {
  availabilitySlotId: string;
}

// Feeds the "EN ESPERA" section of the Bookings screen. `userId` only scopes the
// cache — the request is authenticated by the bearer token.
export function useMyWaitlist(userId: string) {
  return useQuery({
    queryKey: ["waitlist", userId],
    enabled: userId !== "",
    queryFn: () => apiFetch<WaitlistEntryDetail[]>("/waitlist"),
  });
}

// Not one of the three named hooks in the task, but ConflictSheet's "Anotarme"
// action (POST /waitlist) needs a real mutation to call — same shape as
// useCreateBooking, without the idempotency-key/409 handling POST /bookings needs.
export function useJoinWaitlist() {
  return useMutation({
    mutationFn: (input: JoinWaitlistInput) =>
      apiFetch<WaitlistEntry>("/waitlist", {
        method: "POST",
        body: input,
      }),
  });
}

// Reservas handoff (2026-09-15) — the EN ESPERA card's "Cancelar" action. A
// waitlist entry never held capacity, so there's no undo-toast/5s-delay
// dance like DELETE /bookings/{id} — it just leaves.
export function useLeaveWaitlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/waitlist/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["waitlist"] }),
  });
}
