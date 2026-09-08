import { useEffect } from "react";
import { AppState } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { drainCheckinQueue, enqueueCheckin } from "@/lib/checkinQueue";
import { ApiError, apiFetch } from "./client";
import type { CheckinResult } from "./types";

interface CheckinInput {
  code: string;
  force?: boolean;
}

async function postCheckin({ code, force }: CheckinInput): Promise<CheckinResult> {
  return apiFetch<CheckinResult>("/checkins", {
    method: "POST",
    body: { code: code.trim().toUpperCase(), force: force ?? false },
  });
}

export function useSubmitCheckin() {
  const queryClient = useQueryClient();

  return useMutation<CheckinResult, Error, CheckinInput>({
    mutationFn: async (input) => {
      try {
        return await postCheckin(input);
      } catch (err) {
        if (err instanceof ApiError) {
          // The server answered — its JSON body IS a CheckinResult
          // (unknown_code / wrong_space / out_of_window). Surface it as the
          // result so the sheet renders the right variant, not as a throw.
          const body = err.body as CheckinResult | undefined;
          if (body?.status) return body;
          throw err;
        }
        // Genuine network failure — queue it, tell the UI it's pending.
        await enqueueCheckin(input.code);
        return { status: "queued", code: input.code.trim().toUpperCase() };
      }
    },
    onSuccess: (result) => {
      if (result.status === "confirmed" || result.status === "already_confirmed") {
        queryClient.invalidateQueries({ queryKey: ["bookings"] });
      }
    },
  });
}

/** Drains the offline queue on mount, on app foreground, and on demand. */
export function useCheckinQueueDrain() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const run = () =>
      drainCheckinQueue(async (code) => {
        try {
          const result = await postCheckin({ code });
          if (result.status === "confirmed" || result.status === "already_confirmed") {
            queryClient.invalidateQueries({ queryKey: ["bookings"] });
          }
          return "resolved";
        } catch (err) {
          // Server said something (404/403/409) — still a resolution, drop it.
          return err instanceof ApiError ? "resolved" : "retry";
        }
      });

    void run();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void run();
    });
    return () => sub.remove();
  }, [queryClient]);
}
