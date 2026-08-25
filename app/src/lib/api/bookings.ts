import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";

import { ApiError, apiFetch } from "./client";
import type { Booking, BookingConflict } from "./types";

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

  const isConflict = mutation.error instanceof ApiError && mutation.error.status === 409;
  const conflict = isConflict
    ? ((mutation.error as ApiError).body as BookingConflict)
    : undefined;

  return { ...mutation, isConflict, conflict };
}
