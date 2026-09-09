import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { CalendarGrant } from "@/lib/auth/googleCalendar";
import { useUserId } from "@/lib/session";
import { apiFetch } from "./client";

interface CalendarStatus {
  /** The user has connected Google Calendar. */
  connected: boolean;
  /** The server has the OAuth client configured at all. */
  available: boolean;
}

interface CalendarEventResult {
  /** created | not_connected | not_found */
  status: string;
  htmlLink?: string | null;
}

export function useCalendarStatus() {
  const userId = useUserId();
  return useQuery({
    queryKey: ["calendar", "status", userId],
    enabled: userId !== "",
    queryFn: () => apiFetch<CalendarStatus>("/calendar/status"),
    staleTime: 5 * 60_000,
  });
}

/** Exchanges an auth-code grant for a stored refresh token (server-side). */
export function useConnectCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (grant: CalendarGrant) =>
      apiFetch<CalendarStatus>("/calendar/connect", {
        method: "POST",
        body: grant,
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["calendar", "status"] }),
  });
}

export function useDisconnectCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<void>("/calendar/disconnect", { method: "POST" }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["calendar", "status"] }),
  });
}

/** Creates the booking's event on the user's Google Calendar. */
export function useAddToGoogleCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bookingId: string) =>
      apiFetch<CalendarEventResult>("/calendar/events", {
        method: "POST",
        body: { bookingId },
      }),
    onSuccess: (result) => {
      // The server forgets a dead refresh token — reflect that.
      if (result.status === "not_connected") {
        qc.invalidateQueries({ queryKey: ["calendar", "status"] });
      }
    },
  });
}
