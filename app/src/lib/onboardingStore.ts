import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { create } from "zustand";

// Whether the first-run tutorial (`app/welcome.tsx`) has been shown — skipped
// or finished, either counts. Same hand-rolled storage pattern as
// lib/offlineNoticeStore.ts. Hydrated once in `_layout.tsx`, and the splash
// waits for it so the AuthGate never paints Explore for a frame before
// redirecting a first-timer to /welcome.
const STORAGE_KEY = "tempo.onboarding.v1";

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

interface OnboardingState {
  hydrated: boolean;
  seen: boolean;
  hydrate: () => Promise<void>;
  markSeen: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  hydrated: false,
  seen: false,

  hydrate: async () => {
    let raw: string | null = null;
    try {
      raw = await read();
    } catch {
      raw = null;
    }
    set({ hydrated: true, seen: raw === "1" });
  },

  markSeen: () => {
    write("1");
    set({ seen: true });
  },
}));
