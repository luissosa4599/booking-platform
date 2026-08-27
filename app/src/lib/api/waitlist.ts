import { useMutation, useQuery } from "@tanstack/react-query";

import { apiFetch } from "./client";
import type { WaitlistEntry, WaitlistEntryDetail } from "./types";

interface JoinWaitlistInput {
  availabilitySlotId: string;
  userId: string;
}

// Feeds the "EN ESPERA" section of the Bookings screen.
export function useMyWaitlist(userId: string) {
  return useQuery({
    queryKey: ["waitlist", userId],
    queryFn: () =>
      apiFetch<WaitlistEntryDetail[]>(
        `/waitlist?${new URLSearchParams({ userId }).toString()}`,
      ),
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
