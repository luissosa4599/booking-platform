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
  const key = ["notifications", userId] as const;

  return {
    markRead: async () => {
      // Optimistic — opening the sheet should clear the badge instantly, not
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
    },
  };
}
