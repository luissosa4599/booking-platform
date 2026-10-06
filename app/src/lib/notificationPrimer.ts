import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { create } from "zustand";

import { getNotificationPermissionAsync } from "@/lib/notifications";

// The "¿Te avisamos 30 minutos antes?" explainer (NotificationPrimerSheet) —
// for whoever skipped the tutorial's permissions step. Offered once, right
// after a first successful booking (the moment a reminder obviously makes
// sense), and only while the OS dialog can still be shown. Persisted so a
// "Ahora no" is respected across launches.
const STORAGE_KEY = "tempo.notifprimer.v1";

async function readAsked(): Promise<boolean> {
  if (Platform.OS === "web") return true; // no push on web — never offer
  try {
    return (await SecureStore.getItemAsync(STORAGE_KEY)) === "1";
  } catch {
    return false;
  }
}

function writeAsked() {
  if (Platform.OS === "web") return;
  void SecureStore.setItemAsync(STORAGE_KEY, "1").catch(() => {});
}

interface NotificationPrimerState {
  isOpen: boolean;
  /** Opens the sheet if it's worth offering; a no-op otherwise. */
  maybeOpen: () => Promise<void>;
  /** Closes it for good (either answer counts as "asked"). */
  dismiss: () => void;
}

export const useNotificationPrimerStore = create<NotificationPrimerState>((set, get) => ({
  isOpen: false,

  maybeOpen: async () => {
    if (get().isOpen || (await readAsked())) return;
    const permission = await getNotificationPermissionAsync();
    if (!permission || permission.granted || !permission.canAskAgain) return;
    set({ isOpen: true });
  },

  dismiss: () => {
    writeAsked();
    set({ isOpen: false });
  },
}));
