import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { create } from "zustand";

// Whether the one-time "Modo sin conexión" explainer has been shown. After
// that, going offline just shows the slim persistent bar. Same hand-rolled
// storage pattern as lib/theme/themeStore.ts.
const STORAGE_KEY = "tempo.offlinenotice.v1";

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

interface OfflineNoticeState {
  hydrated: boolean;
  seen: boolean;
  hydrate: () => Promise<void>;
  markSeen: () => void;
}

export const useOfflineNoticeStore = create<OfflineNoticeState>((set) => ({
  hydrated: false,
  seen: false,

  hydrate: async () => {
    const raw = await read();
    set({ hydrated: true, seen: raw === "1" });
  },

  markSeen: () => {
    write("1");
    set({ seen: true });
  },
}));
