import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";

import { ApiError, apiFetch } from "./client";
import type {
  Booking,
  BookingConflict,
  BookingScope,
  MyBooking,
} from "./types";

interface CreateBookingInput {
  availabilitySlotId: string;
  userId: string;
  seats: number;
}

export function useCreateBooking() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (input: CreateBookingInput) => {
      // A fresh Idempotency-Key per attempt — never reused across distinct
      // user attempts, so retrying a genuinely new tap never gets mistaken
      // for a duplicate of a previous one.
      const idempotencyKey = Crypto.randomUUID();

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

export function useMyBookings(scope: BookingScope, userId: string) {
  return useQuery({
    queryKey: ["bookings", { scope, userId }],
    queryFn: () =>
      apiFetch<MyBooking[]>(
        `/bookings?${new URLSearchParams({ userId, scope }).toString()}`,
      ),
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
    },
  });
}
