import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { create } from "zustand";

// Persists the id of the last-dismissed "próxima reserva" banner (Explore's
// NextBookingBanner) — same hand-rolled storage pattern as
// lib/offlineNoticeStore.ts / lib/theme/themeStore.ts. Keyed by booking id,
// not a plain boolean: dismissing today's next booking shouldn't also hide
// the banner forever once a *different* booking becomes the next one.
const STORAGE_KEY = "tempo.nextbookingbanner.dismissed.v1";

async function read(): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(STORAGE_KEY);
}

function write(value: string) {
  if (Platform.OS === "web") {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* private mode — just won't persist */
    }
    return;
  }
  void SecureStore.setItemAsync(STORAGE_KEY, value);
}

interface NextBookingBannerState {
  hydrated: boolean;
  dismissedBookingId: string | null;
  hydrate: () => Promise<void>;
  dismiss: (bookingId: string) => void;
}

export const useNextBookingBannerStore = create<NextBookingBannerState>((set) => ({
  hydrated: false,
  dismissedBookingId: null,

  hydrate: async () => {
    const raw = await read();
    set({ hydrated: true, dismissedBookingId: raw });
  },

  dismiss: (bookingId) => {
    write(bookingId);
    set({ dismissedBookingId: bookingId });
  },
}));
