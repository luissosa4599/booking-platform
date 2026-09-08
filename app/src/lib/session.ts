import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { create } from "zustand";

import { apiFetch, setAuthHandlers } from "@/lib/api/client";
import { registerForPushNotificationsAsync } from "@/lib/notifications";

const STORAGE_KEY = "tempo.session.v1";
// Which side of the app a host is currently looking at. Persisted SEPARATELY
// from the session blob: `refresh()` rebuilds the session from the server every
// ~30 min and would otherwise wipe this. Only meaningful when role === "host".
const VIEW_MODE_KEY = "tempo.viewmode.v1";

export type AccountRole = "guest" | "host";
export type ViewMode = "guest" | "host";

export interface Session {
  userId: string;
  email: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  role: AccountRole;
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
    role?: string | null;
  };
}

// expo-secure-store has no web implementation — fall back to localStorage there
// (a demo auth, not real secrets).
const storage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === "web") {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    }
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === "web") {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        /* private mode / storage blocked — just won't persist */
      }
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  async remove(key: string): Promise<void> {
    if (Platform.OS === "web") {
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

function toRole(role?: string | null): AccountRole {
  return role === "host" ? "host" : "guest";
}

function toSession(res: SessionResponse): Session {
  return {
    userId: res.user.id,
    email: res.user.email,
    displayName: res.user.displayName ?? null,
    avatarUrl: res.user.avatarUrl ?? null,
    role: toRole(res.user.role),
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
  /** "guest" | "host" — which UI a host is in. Ignored while role === "guest". */
  viewMode: ViewMode;
  hydrate: () => Promise<void>;
  /** Real Google OAuth2 — pass the Google ID token from expo-auth-session. */
  signInWithGoogle: (idToken: string) => Promise<void>;
  /** Dev-only simulated magic link (no mail). Kept for local testing. */
  requestLink: (email: string) => Promise<RequestLinkResult>;
  verify: (token: string) => Promise<void>;
  /** Rotate the refresh token for a fresh access token. Throws on failure. */
  refresh: () => Promise<void>;
  /** Self-upgrade to host. Server re-issues the session so the new token carries role=host. */
  becomeHost: () => Promise<void>;
  /** Switch a host between their own UI and the guest UI. Persisted. */
  setViewMode: (mode: ViewMode) => void;
  signOut: () => Promise<void>;
}

async function persist(set: (partial: Partial<AuthState>) => void, session: Session) {
  await storage.set(STORAGE_KEY, JSON.stringify(session));
  set({ session });
}

// A burst of requests can all 401 at once (access token just expired). They must
// share ONE refresh — a second call with the just-rotated token would look like
// a replay and get the whole chain revoked. This holds the in-flight promise.
let refreshInFlight: Promise<void> | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  hydrated: false,
  session: null,
  viewMode: "host",

  hydrate: async () => {
    const [rawSession, rawViewMode] = await Promise.all([
      storage.get(STORAGE_KEY),
      storage.get(VIEW_MODE_KEY),
    ]);
    let session: Session | null = null;
    if (rawSession) {
      try {
        const parsed = JSON.parse(rawSession) as Partial<Session>;
        // Older persisted sessions have no `role` — default to guest.
        session = { ...(parsed as Session), role: toRole(parsed.role) };
      } catch {
        session = null;
      }
    }
    set({
      hydrated: true,
      session,
      viewMode: rawViewMode === "guest" ? "guest" : "host",
    });
  },

  signInWithGoogle: async (idToken) => {
    const res = await apiFetch<SessionResponse>("/auth/google", {
      method: "POST",
      body: { idToken },
    });
    await persist(set, toSession(res));
    void registerForPushNotificationsAsync();
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
    void registerForPushNotificationsAsync();
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

  becomeHost: async () => {
    const res = await apiFetch<SessionResponse>("/me/become-host", {
      method: "POST",
    });
    await persist(set, toSession(res));
    get().setViewMode("host");
  },

  setViewMode: (mode) => {
    void storage.set(VIEW_MODE_KEY, mode);
    set({ viewMode: mode });
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
    await Promise.all([storage.remove(STORAGE_KEY), storage.remove(VIEW_MODE_KEY)]);
    set({ session: null, viewMode: "host" });
  },
}));

// Wire the API client to the store: attach the bearer token, refresh on 401,
// and drop the session if the refresh fails.
setAuthHandlers({
  getAccessToken: () => useAuthStore.getState().session?.accessToken ?? null,
  refresh: () => useAuthStore.getState().refresh(),
  onAuthLost: () => {
    void storage.remove(STORAGE_KEY);
    void storage.remove(VIEW_MODE_KEY);
    useAuthStore.setState({ session: null, viewMode: "host" });
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

export function useRole(): AccountRole {
  return useAuthStore((s) => s.session?.role ?? "guest");
}

export function useViewMode(): ViewMode {
  return useAuthStore((s) => s.viewMode);
}

/** True when a host account is currently looking at the host UI. */
export function useIsHostView(): boolean {
  return useAuthStore((s) => s.session?.role === "host" && s.viewMode === "host");
}
