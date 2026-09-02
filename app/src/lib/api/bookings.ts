import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { uuid } from "@/lib/uuid";
import { ApiError, apiFetch } from "./client";
import type {
  Booking,
  BookingConflict,
  BookingScope,
  BookingStreak,
  MyBooking,
} from "./types";

interface CreateBookingInput {
  availabilitySlotId: string;
  seats: number;
  /**
   * The slot's `rowVersion` as the client last saw it. When sent, the backend
   * rejects the booking with 409 (carrying `alternatives`) if the slot moved on
   * since — so a tap on stale availability data surfaces the ConflictSheet
   * instead of silently racing.
   */
  rowVersion?: number;
}

export function useCreateBooking() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (input: CreateBookingInput) => {
      // A fresh Idempotency-Key per attempt — never reused across distinct
      // user attempts, so retrying a genuinely new tap never gets mistaken
      // for a duplicate of a previous one.
      const idempotencyKey = uuid();

      return apiFetch<Booking>("/bookings", {
        method: "POST",
        body: input,
        headers: { "Idempotency-Key": idempotencyKey },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["availability"] });
    },
  });

  const isConflict =
    mutation.error instanceof ApiError && mutation.error.status === 409;
  const conflict = isConflict
    ? ((mutation.error as ApiError).body as BookingConflict)
    : undefined;

  return { ...mutation, isConflict, conflict };
}

// `userId` scopes the query cache (so a re-login for a different account doesn't
// show stale rows) — the request itself is authenticated by the bearer token,
// the server derives the user from it.
export function useMyBookings(scope: BookingScope, userId: string) {
  return useQuery({
    queryKey: ["bookings", { scope, userId }],
    enabled: userId !== "",
    queryFn: () =>
      apiFetch<MyBooking[]>(
        `/bookings?${new URLSearchParams({ scope }).toString()}`,
      ),
  });
}

// Feeds the ConfirmedScreen "Octava semana seguida" line — shown only when
// weeks >= 3, per the handoff.
export function useBookingStreak(userId: string) {
  return useQuery({
    queryKey: ["bookings", "streak", userId],
    enabled: userId !== "",
    queryFn: () => apiFetch<BookingStreak>("/bookings/streak"),
  });
}

// Handoff § "05 · BookingsScreen": "Cancelar (optimista, reversible) ... El
// DELETE se envía al expirar el toast, no antes." So the row's own optimistic
// removal + 5s undo window is UI-only state on the calling screen — this
// mutation only ever fires once that window has actually elapsed without an
// undo, which is also why there's no onMutate/rollback here: by the time
// this runs, the user has already committed to cancelling.
export function useCancelBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (bookingId: string) =>
      apiFetch<void>(`/bookings/${bookingId}`, { method: "DELETE" }),
    // The 30-min reminder is now sent server-side by the notification worker
    // (see CLAUDE.md) — no local scheduling to cancel here anymore. The
    // worker's own dedupe (SentNotification, keyed by booking id + type) is
    // what would need to stop a reminder from firing, and it naturally won't:
    // ReminderService only ever looks at bookings still Confirmed.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
    },
  });
}
