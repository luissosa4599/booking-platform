import * as Location from "expo-location";
import { AppState, Linking, Platform } from "react-native";
import { create } from "zustand";

import { getCalendarPermissionAsync, requestCalendarPermissionAsync } from "@/lib/calendar";
import { getLocationPermission } from "@/lib/location";

// What happens when someone taps an action that needs a permission they
// already turned down (2026-10-06 request). Follows the platform guidance:
// Android's "Request runtime permissions" flow — granted → go; never asked →
// the system dialog, in context; denied but the system can still ask → explain
// why, then ask again; permanently denied (the system won't show its dialog
// anymore) → explain and offer a button to the app's settings. Apple's HIG says
// the same for iOS (explain + link to Settings, never nag). Never blocks
// anything else — "Ahora no" always closes it.

export type PermissionKind = "location" | "calendar";

/** How the explainer helps: re-show the system dialog, or open Settings. */
export type PermissionPromptMode = "ask" | "settings";

export interface PermissionFallback {
  label: string;
  run: () => void;
}

interface PermissionPromptState {
  kind: PermissionKind | null;
  mode: PermissionPromptMode;
  onGranted: (() => void) | null;
  fallback: PermissionFallback | null;
  open: (args: {
    kind: PermissionKind;
    mode: PermissionPromptMode;
    onGranted?: () => void;
    fallback?: PermissionFallback;
  }) => void;
  close: () => void;
  /** "Permitir" in ask mode: show the system dialog again. */
  askAgain: () => Promise<void>;
  /** "Abrir Configuración": jump to the OS settings, continue on return. */
  openSettings: () => void;
}

interface PermissionInfo {
  granted: boolean;
  canAskAgain: boolean;
  status: "granted" | "denied" | "undetermined";
}

async function read(kind: PermissionKind): Promise<PermissionInfo | null> {
  return kind === "location" ? getLocationPermission() : getCalendarPermissionAsync();
}

async function request(kind: PermissionKind): Promise<boolean> {
  if (kind === "calendar") return requestCalendarPermissionAsync();
  try {
    return (await Location.requestForegroundPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

// Set while the user is off in the OS settings: when the app comes back to the
// foreground with the permission now granted, the action they originally
// tapped continues on its own instead of making them tap it again.
let pendingAfterSettings: { kind: PermissionKind; onGranted: () => void } | null = null;
AppState.addEventListener("change", (state) => {
  if (state !== "active" || !pendingAfterSettings) return;
  const pending = pendingAfterSettings;
  pendingAfterSettings = null;
  void read(pending.kind).then((p) => {
    if (p?.granted) pending.onGranted();
  });
});

export const usePermissionPromptStore = create<PermissionPromptState>((set, get) => ({
  kind: null,
  mode: "ask",
  onGranted: null,
  fallback: null,

  open: ({ kind, mode, onGranted, fallback }) =>
    set({ kind, mode, onGranted: onGranted ?? null, fallback: fallback ?? null }),

  close: () => set({ kind: null, onGranted: null, fallback: null }),

  askAgain: async () => {
    const { kind, onGranted } = get();
    if (!kind) return;
    get().close();
    if (await request(kind)) onGranted?.();
  },

  openSettings: () => {
    const { kind, onGranted } = get();
    get().close();
    if (kind && onGranted) pendingAfterSettings = { kind, onGranted };
    void Linking.openSettings().catch(() => {
      pendingAfterSettings = null;
    });
  },
}));

export type EnsureResult =
  /** Allowed — go ahead. */
  | "granted"
  /** The user just said no to the system dialog — respect it, no extra UI. */
  | "denied"
  /** Previously denied: the explainer is now open and owns what happens next. */
  | "explaining";

/**
 * Call right before an action that needs `kind`. See the header comment for
 * the flow. `onGranted` re-runs the action if the user grants it from the
 * explainer (or from Settings); `fallback` adds a secondary button (e.g.
 * "Copiar los detalles" instead of adding to the calendar).
 */
export async function ensurePermission(
  kind: PermissionKind,
  opts: { onGranted?: () => void; fallback?: PermissionFallback } = {},
): Promise<EnsureResult> {
  const current = await read(kind);
  if (!current) return "denied";
  if (current.granted) return "granted";
  if (current.status === "undetermined") {
    return (await request(kind)) ? "granted" : "denied";
  }
  usePermissionPromptStore.getState().open({
    kind,
    // The web has no "app settings" to open, and a browser won't re-show a
    // blocked prompt — explain where to unblock it instead.
    mode: Platform.OS !== "web" && current.canAskAgain ? "ask" : "settings",
    onGranted: opts.onGranted,
    fallback: opts.fallback,
  });
  return "explaining";
}
