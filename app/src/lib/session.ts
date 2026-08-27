import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { create } from "zustand";

import { apiFetch } from "@/lib/api/client";

const STORAGE_KEY = "cupo.session.v1";

export interface Session {
  userId: string;
  email: string;
}

// expo-secure-store has no web implementation — fall back to localStorage there
// (a demo auth, not real secrets).
const storage = {
  async get(): Promise<string | null> {
    if (Platform.OS === "web") {
      try {
        return window.localStorage.getItem(STORAGE_KEY);
      } catch {
        return null;
      }
    }
    return SecureStore.getItemAsync(STORAGE_KEY);
  },
  async set(value: string): Promise<void> {
    if (Platform.OS === "web") {
      try {
        window.localStorage.setItem(STORAGE_KEY, value);
      } catch {
        /* private mode / storage blocked — session just won't persist */
      }
      return;
    }
    await SecureStore.setItemAsync(STORAGE_KEY, value);
  },
  async remove(): Promise<void> {
    if (Platform.OS === "web") {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      return;
    }
    await SecureStore.deleteItemAsync(STORAGE_KEY);
  },
};

interface RequestLinkResult {
  token: string;
  magicLink: string;
}

interface AuthState {
  /** false until the persisted session has been read once at startup. */
  hydrated: boolean;
  session: Session | null;
  hydrate: () => Promise<void>;
  requestLink: (email: string) => Promise<RequestLinkResult>;
  verify: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  hydrated: false,
  session: null,

  hydrate: async () => {
    const raw = await storage.get();
    let session: Session | null = null;
    if (raw) {
      try {
        session = JSON.parse(raw) as Session;
      } catch {
        session = null;
      }
    }
    set({ hydrated: true, session });
  },

  requestLink: (email) =>
    apiFetch<RequestLinkResult>("/auth/request-link", {
      method: "POST",
      body: { email: email.trim() },
    }),

  verify: async (token) => {
    const res = await apiFetch<{ userId: string; email: string }>(
      "/auth/verify",
      { method: "POST", body: { token } },
    );
    const session: Session = { userId: res.userId, email: res.email };
    await storage.set(JSON.stringify(session));
    set({ session });
  },

  signOut: async () => {
    await storage.remove();
    set({ session: null });
  },
}));

/** Reactive user id for hooks — "" before sign-in (screens behind the gate never see that). */
export function useUserId(): string {
  return useAuthStore((s) => s.session?.userId ?? "");
}

/** Non-reactive user id for event handlers. */
export function getUserId(): string {
  return useAuthStore.getState().session?.userId ?? "";
}
