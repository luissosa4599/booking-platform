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

// Android 13+ only shows the POST_NOTIFICATIONS prompt once at least one
// notification channel exists, so make sure ours does before asking. Name is
// what Android's per-app notification settings list.
async function ensureAndroidChannel(Notifications: NotificationsModule): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Recordatorios y avisos",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  } catch {
    // best-effort
  }
}

export interface NotificationPermission {
  granted: boolean;
  canAskAgain: boolean;
}

/** Current permission, or `null` where push isn't supported (web, Expo Go). */
export async function getNotificationPermissionAsync(): Promise<NotificationPermission | null> {
  const Notifications = loadNotifications();
  if (!Notifications) return null;
  try {
    const { granted, canAskAgain } = await Notifications.getPermissionsAsync();
    return { granted, canAskAgain };
  } catch {
    return null;
  }
}

/**
 * Shows the OS permission dialog (if it can still be shown) and resolves
 * whether notifications are allowed. Only call this from an explicit user tap
 * on a screen that already explained why (the tutorial's permissions step,
 * `NotificationPrimerSheet`) — never cold. Doesn't need a session: the token
 * is registered with the API later, after sign-in.
 */
export async function requestNotificationPermissionAsync(): Promise<boolean> {
  const Notifications = loadNotifications();
  if (!Notifications) return false;
  try {
    await ensureAndroidChannel(Notifications);
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/**
 * Registers this device for push notifications: gets an Expo push token and
 * POSTs it to `/devices`. Silently does nothing on web, in Expo Go, without
 * permission, or without an EAS project id configured (`app.config.ts`'s
 * `extra.eas.projectId`) — push is a best-effort feature, never worth
 * surfacing an error for.
 *
 * `prompt: false` (the default, used right after sign-in) never shows the OS
 * dialog — it only registers when permission was already granted. The dialog
 * is only ever shown after an explanation (2026-10-06: "una explicación rápida
 * de por qué se requiere cada permiso").
 */
export async function registerForPushNotificationsAsync(
  { prompt = false }: { prompt?: boolean } = {},
): Promise<void> {
  const Notifications = loadNotifications();
  if (!Notifications) return;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) return;

  try {
    await ensureAndroidChannel(Notifications);
    const current = await Notifications.getPermissionsAsync();
    let granted = current.granted;
    if (!granted && prompt && current.canAskAgain) {
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
