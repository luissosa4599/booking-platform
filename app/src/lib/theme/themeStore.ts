import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { create } from "zustand";

const STORAGE_KEY = "tempo.theme.v1";

/** "system" follows the OS; "light"/"dark" are explicit user overrides. */
export type ThemePreference = "system" | "light" | "dark";

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

interface ThemeState {
  /** false until the persisted preference has been read once. */
  hydrated: boolean;
  preference: ThemePreference;
  hydrate: () => Promise<void>;
  setPreference: (preference: ThemePreference) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  hydrated: false,
  preference: "system",

  hydrate: async () => {
    const raw = await read();
    set({
      hydrated: true,
      preference: raw === "light" || raw === "dark" ? raw : "system",
    });
  },

  setPreference: (preference) => {
    write(preference);
    set({ preference });
  },
}));
