import { useMutation } from "@tanstack/react-query";

import { apiFetch } from "./client";
import type { WaitlistEntry } from "./types";

interface JoinWaitlistInput {
  availabilitySlotId: string;
  userId: string;
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
