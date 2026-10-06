import { create } from "zustand";

import { useAuthStore } from "@/lib/session";

// Guest mode (2026-10-06): there's no sign-in wall anymore — without a session
// the app opens on Explore. Anything that needs an account goes through
// `requireAccount()`, which opens a root-mounted modal ("Para acceder a esta
// función tienes que iniciar sesión") instead of redirecting to /sign-in. The
// user only lands on /sign-in if they choose "Iniciar sesión" there.

interface SignInPromptState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useSignInPromptStore = create<SignInPromptState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));

/**
 * `true` when there's a session (go ahead). Otherwise opens the sign-in modal
 * and returns `false` — the caller just bails out. Safe to call from any event
 * handler (reads the store directly, not a hook).
 */
export function requireAccount(): boolean {
  if (useAuthStore.getState().session) return true;
  useSignInPromptStore.getState().open();
  return false;
}
