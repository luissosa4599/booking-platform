import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { create } from "zustand";

import { apiFetch, setAuthHandlers } from "@/lib/api/client";

const STORAGE_KEY = "tempo.session.v1";

export interface Session {
  userId: string;
  email: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  accessToken: string;
  refreshToken: string;
}

// The wire shape of /auth/google, /auth/refresh and the dev /auth/verify.
interface SessionResponse {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  user: {
    id: string;
    email: string;
    displayName?: string | null;
    avatarUrl?: string | null;
  };
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

function toSession(res: SessionResponse): Session {
  return {
    userId: res.user.id,
    email: res.user.email,
    displayName: res.user.displayName ?? null,
    avatarUrl: res.user.avatarUrl ?? null,
    accessToken: res.accessToken,
    refreshToken: res.refreshToken,
  };
}

interface RequestLinkResult {
  token: string;
  magicLink: string;
}

interface AuthState {
  /** false until the persisted session has been read once at startup. */
  hydrated: boolean;
  session: Session | null;
  hydrate: () => Promise<void>;
  /** Real Google OAuth2 — pass the Google ID token from expo-auth-session. */
  signInWithGoogle: (idToken: string) => Promise<void>;
  /** Dev-only simulated magic link (no mail). Kept for local testing. */
  requestLink: (email: string) => Promise<RequestLinkResult>;
  verify: (token: string) => Promise<void>;
  /** Rotate the refresh token for a fresh access token. Throws on failure. */
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

async function persist(set: (partial: Partial<AuthState>) => void, session: Session) {
  await storage.set(JSON.stringify(session));
  set({ session });
}

// A burst of requests can all 401 at once (access token just expired). They must
// share ONE refresh — a second call with the just-rotated token would look like
// a replay and get the whole chain revoked. This holds the in-flight promise.
let refreshInFlight: Promise<void> | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
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

  signInWithGoogle: async (idToken) => {
    const res = await apiFetch<SessionResponse>("/auth/google", {
      method: "POST",
      body: { idToken },
    });
    await persist(set, toSession(res));
  },

  requestLink: (email) =>
    apiFetch<RequestLinkResult>("/auth/request-link", {
      method: "POST",
      body: { email: email.trim() },
    }),

  verify: async (token) => {
    const res = await apiFetch<SessionResponse>("/auth/verify", {
      method: "POST",
      body: { token },
    });
    await persist(set, toSession(res));
  },

  refresh: () => {
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = (async () => {
      try {
        const current = get().session;
        if (!current) throw new Error("No session to refresh");
        const res = await apiFetch<SessionResponse>("/auth/refresh", {
          method: "POST",
          body: { refreshToken: current.refreshToken },
        });
        await persist(set, toSession(res));
      } finally {
        refreshInFlight = null;
      }
    })();
    return refreshInFlight;
  },

  signOut: async () => {
    const current = get().session;
    if (current) {
      // Best-effort — revoke the refresh token server-side, ignore failures.
      void apiFetch("/auth/logout", {
        method: "POST",
        body: { refreshToken: current.refreshToken },
      }).catch(() => {});
    }
    await storage.remove();
    set({ session: null });
  },
}));

// Wire the API client to the store: attach the bearer token, refresh on 401,
// and drop the session if the refresh fails.
setAuthHandlers({
  getAccessToken: () => useAuthStore.getState().session?.accessToken ?? null,
  refresh: () => useAuthStore.getState().refresh(),
  onAuthLost: () => {
    void storage.remove();
    useAuthStore.setState({ session: null });
  },
});

/** Reactive user id for hooks — "" before sign-in (screens behind the gate never see that). */
export function useUserId(): string {
  return useAuthStore((s) => s.session?.userId ?? "");
}

/** Non-reactive user id for event handlers. */
export function getUserId(): string {
  return useAuthStore.getState().session?.userId ?? "";
}
