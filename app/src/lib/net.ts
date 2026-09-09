import { useSyncExternalStore } from "react";
import { AppState, Platform } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { focusManager, onlineManager } from "@tanstack/react-query";

// `isInternetReachable` is often null on web / before the first probe — treat
// unknown as online so the app doesn't wrongly think it's permanently offline.
function isNetInfoOnline(state: {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
}) {
  return !!state.isConnected && state.isInternetReachable !== false;
}

const isWeb = Platform.OS === "web";

function webOnline() {
  try {
    return typeof navigator === "undefined" || navigator.onLine !== false;
  } catch {
    return true;
  }
}

let wired = false;

/** Point TanStack Query's online/focus managers at connectivity + AppState. Idempotent. */
export function wireConnectivity() {
  if (wired) return;
  wired = true;

  if (isWeb) {
    // react-native-web: navigator.onLine + the window online/offline events are
    // the reliable signal (same "listen to the browser directly" approach as
    // ThemeProvider's matchMedia).
    onlineManager.setEventListener((setOnline) => {
      const update = () => setOnline(webOnline());
      window.addEventListener("online", update);
      window.addEventListener("offline", update);
      update();
      return () => {
        window.removeEventListener("online", update);
        window.removeEventListener("offline", update);
      };
    });
  } else {
    onlineManager.setEventListener((setOnline) =>
      NetInfo.addEventListener((state) => setOnline(isNetInfoOnline(state))),
    );
  }

  const sub = AppState.addEventListener("change", (status) =>
    focusManager.setFocused(status === "active"),
  );
  void sub; // lives for the app's lifetime
}

/** Reactive "is the app currently offline?" — backed by onlineManager. */
export function useIsOffline(): boolean {
  return useSyncExternalStore(
    (cb) => onlineManager.subscribe(cb),
    () => !onlineManager.isOnline(),
    () => false,
  );
}

/** Run `fn` once the device reconnects (used to drain the check-in queue). */
export function onReconnect(fn: () => void): () => void {
  if (isWeb) {
    const handler = () => {
      if (webOnline()) fn();
    };
    window.addEventListener("online", handler);
    return () => window.removeEventListener("online", handler);
  }
  return NetInfo.addEventListener((state) => {
    if (isNetInfoOnline(state)) fn();
  });
}
