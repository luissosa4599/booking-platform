import { isRunningInExpoGo } from "expo";
import Constants from "expo-constants";
import { Platform } from "react-native";

import { apiFetch } from "@/lib/api/client";

type NotificationsModule = typeof import("expo-notifications");

// `expo-notifications` CANNOT be imported at module load in Expo Go on Android:
// its DevicePushTokenAutoRegistration side-effect calls warnOfExpoGoPushUsage,
// which `throw`s (SDK 53+ removed push from Expo Go). So it's require()d lazily
// and only outside Expo Go / web — push is a native-dev-build feature, silently
// absent elsewhere.
function loadNotifications(): NotificationsModule | null {
  if (Platform.OS === "web" || isRunningInExpoGo()) {
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-notifications") as NotificationsModule;
  } catch {
    return null;
  }
}

// Booking reminders and waitlist-opening pushes are now sent server-side by
// the notification worker (api/BookingEngine.Worker) — see CLAUDE.md. This
// file's job on the client is only: ask for permission, get an Expo push
// token, and hand it to the API. There's no local scheduling here anymore
// (the old client-local 30-min reminder only ever covered the long booking
// flow; the server-side reminder covers every booking, including the
// one-tap Explore flow, which the old approach never reached).

/**
 * Registers this device for push notifications: requests permission, gets an
 * Expo push token, and POSTs it to `/devices`. Silently does nothing on web,
 * in Expo Go, without permission, or without an EAS project id configured
 * (`app.config.ts`'s `extra.eas.projectId` — unset until `eas init` runs) —
 * push is a best-effort feature, never worth surfacing an error for.
 */
export async function registerForPushNotificationsAsync(): Promise<void> {
  const Notifications = loadNotifications();
  if (!Notifications) return;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) return;

  try {
    const current = await Notifications.getPermissionsAsync();
    let granted = current.granted;
    if (!granted && current.canAskAgain) {
      granted = (await Notifications.requestPermissionsAsync()).granted;
    }
    if (!granted) return;

    const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({ projectId });

    await apiFetch("/devices", {
      method: "POST",
      body: { expoPushToken, platform: Platform.OS },
    });
  } catch {
    // Best-effort — a missing push registration is not worth interrupting
    // sign-in for, and there's nothing actionable to show the user.
  }
}
