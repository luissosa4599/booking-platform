import { useCallback } from "react";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";

// Finishes the auth session when the browser redirects back (web + native).
WebBrowser.maybeCompleteAuthSession();

const clientIds = {
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
};

/** True when at least one Google OAuth client id is configured for this platform. */
export function isGoogleAuthConfigured(): boolean {
  return Boolean(
    clientIds.webClientId || clientIds.iosClientId || clientIds.androidClientId,
  );
}

export interface GoogleAuth {
  /** The auth request is built — safe to call `signIn`. */
  ready: boolean;
  /** Opens Google's consent flow. Resolves the ID token, or null if cancelled/dismissed. */
  signIn: () => Promise<string | null>;
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
