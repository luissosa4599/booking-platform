import { isRunningInExpoGo } from "expo";
import { Platform } from "react-native";

// Handoff § "04 · ConfirmedScreen": "Te avisamos 30 minutos antes." Scheduled
// on confirm, cancelled by booking id when the booking is cancelled.
const REMINDER_LEAD_MS = 30 * 60 * 1000;

type NotificationsModule = typeof import("expo-notifications");

// `expo-notifications` CANNOT be imported at module load in Expo Go on Android:
// its DevicePushTokenAutoRegistration side-effect calls warnOfExpoGoPushUsage,
// which `throw`s (SDK 53+ removed push from Expo Go). So it's require()d lazily
// and only outside Expo Go / web — the reminder is a native-dev-build feature,
// silently absent elsewhere.
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

interface ReminderInput {
  bookingId: string;
  resourceName: string;
  startsAt: string;
}

/** Resolves true only if a reminder was actually scheduled. */
export async function scheduleBookingReminder({
  bookingId,
  resourceName,
  startsAt,
}: ReminderInput): Promise<boolean> {
  const Notifications = loadNotifications();
  if (!Notifications) return false;

  const fireAt = new Date(new Date(startsAt).getTime() - REMINDER_LEAD_MS);
  if (fireAt.getTime() <= Date.now()) return false; // starts in under 30 min

  try {
    const current = await Notifications.getPermissionsAsync();
    let granted = current.granted;
    if (!granted && current.canAskAgain) {
      granted = (await Notifications.requestPermissionsAsync()).granted;
    }
    if (!granted) return false;

    await Notifications.scheduleNotificationAsync({
      identifier: bookingId,
      content: {
        title: resourceName,
        body: "Tu reserva empieza en 30 minutos.",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireAt,
      },
    });
    return true;
  } catch {
    // Best-effort — a missing reminder is not worth interrupting the flow for.
    return false;
  }
}

export async function cancelBookingReminder(bookingId: string): Promise<void> {
  const Notifications = loadNotifications();
  if (!Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(bookingId);
  } catch {
    // Already fired or never scheduled — nothing to do.
  }
}
