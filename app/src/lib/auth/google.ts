import { useCallback } from "react";
import { Platform } from "react-native";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";

import type { GoogleAuth } from "./google.types";

// **Web only** — `google.native.ts` overrides this on iOS/Android (Metro's
// platform-suffix resolution, see tsconfig `moduleSuffixes`). The
// browser-redirect flow here relies on a custom-URI-scheme redirect back
// into the app, which Google has deprecated/blocked for "Android"/"iOS"
// OAuth client types (real "Error 400: invalid_request" hit 2026-09-14 on
// the first Android build) — it only ever worked, and still works, for the
// Web client type used here.
WebBrowser.maybeCompleteAuthSession();

const clientIds = {
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
};

/**
 * True only when the OAuth client id for the *current* platform is set —
 * `Google.useIdTokenAuthRequest` throws synchronously during render if the
 * id for `Platform.OS` is missing (it does NOT fall back to another
 * platform's id), so this has to be per-platform, not "is any id set".
 */
export function isGoogleAuthConfigured(): boolean {
  const idForPlatform =
    Platform.OS === "ios"
      ? clientIds.iosClientId
      : Platform.OS === "android"
        ? clientIds.androidClientId
        : clientIds.webClientId;
  return Boolean(idForPlatform);
}

export function useGoogleAuth(): GoogleAuth {
  const [request, , promptAsync] = Google.useIdTokenAuthRequest(clientIds);

  const signIn = useCallback(async (): Promise<string | null> => {
    const result = await promptAsync();
    if (result.type !== "success") {
      return null;
    }
    return (
      result.params?.id_token ??
      result.authentication?.idToken ??
      null
    );
  }, [promptAsync]);

  return { ready: request !== null, signIn };
}
