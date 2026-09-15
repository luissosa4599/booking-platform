import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useUserId } from "@/lib/session";
import { apiFetch } from "./client";

/** Mirrors the API's `NotificationResponse` — deliberately no pre-built
 * display sentence, see `lib/notificationCopy.ts`. */
export interface AppNotification {
  id: string;
  type: "reminder" | "waitlist_slot_opened" | "booking_cancelled_by_host";
  resourceName: string | null;
  slotStartsAt: string | null;
  bookingId: string | null;
  availabilitySlotId: string | null;
  isRead: boolean;
  sentAt: string;
}

interface NotificationsResponse {
  notifications: AppNotification[];
  unreadCount: number;
}

// `userId` only scopes the cache — same convention as `useFavorites`.
export function useNotifications() {
  const userId = useUserId();
  const query = useQuery({
    queryKey: ["notifications", userId],
    enabled: userId !== "",
    queryFn: () => apiFetch<NotificationsResponse>("/notifications"),
    // Short — this is a "what's new" feed, not static reference data. No
    // polling: refetches on focus/mount are enough for a demo, a real
    // unread-count push would need a socket, out of scope here.
    staleTime: 30_000,
  });

  return {
    ...query,
    notifications: query.data?.notifications ?? [],
    unreadCount: query.data?.unreadCount ?? 0,
  };
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  const userId = useUserId();

  // Stable identity — the notifications screen calls this once on mount via
  // a `useEffect([markRead])`; a fresh function every render (the previous
  // shape here) would put a different value in that dependency array each
  // time and loop the effect forever. `key` is built from `userId` *inside*
  // the callback rather than closed over from an outer `const key = [...]`,
  // so the exhaustive-deps check has an actual stable dependency (`userId`)
  // instead of a new array literal every render.
  const markRead = useCallback(async () => {
    const key = ["notifications", userId] as const;

    // Optimistic — opening the screen should clear the badge instantly, not
    // after a round trip.
    qc.setQueryData<NotificationsResponse>(key, (prev) =>
      prev
        ? {
            unreadCount: 0,
            notifications: prev.notifications.map((n) => ({ ...n, isRead: true })),
          }
        : prev,
    );
    try {
      await apiFetch<void>("/notifications/read-all", { method: "POST" });
    } finally {
      await qc.invalidateQueries({ queryKey: key });
    }
  }, [qc, userId]);

  return { markRead };
}
