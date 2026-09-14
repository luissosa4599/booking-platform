import { useCallback } from "react";
import { Platform } from "react-native";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";

import { isGoogleAuthConfigured } from "@/lib/auth/google";

WebBrowser.maybeCompleteAuthSession();

// Google's "Web" OAuth client type rejects a bare custom-scheme redirect_uri
// (confirmed in Console: "Debe contener el nombre de un dominio") — on
// native, `AuthSession.makeRedirectUri()`'s default `app://` never validates.
// Send Google to a real page on our own domain instead; that page's only job
// is forwarding the callback on to `app://` itself (src/app/auth/calendar-
// bridge.tsx) — the second hop `expo-auth-session`'s native listener actually
// needs. Web keeps using makeRedirectUri() (already works, already verified
// against real Google).
const NATIVE_BRIDGE_REDIRECT_URI = "https://tempo-cyan-alpha.vercel.app/auth/calendar-bridge";

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

const discovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  revocationEndpoint: "https://oauth2.googleapis.com/revoke",
};

// The *web* client id — the Calendar exchange/refresh always happens
// server-side against that client + its secret.
const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

export interface CalendarGrant {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}

export interface GoogleCalendarAuth {
  ready: boolean;
  /**
   * Opens Google's consent screen for the calendar.events scope with
   * `access_type=offline` + `prompt=consent` (so the server gets a refresh
   * token). Resolves the auth code + PKCE verifier, or null if cancelled.
   */
  authorize: () => Promise<CalendarGrant | null>;
}

export function useGoogleCalendarAuth(): GoogleCalendarAuth {
  const redirectUri =
    Platform.OS === "web" ? AuthSession.makeRedirectUri() : NATIVE_BRIDGE_REDIRECT_URI;

  const [request, , promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: webClientId ?? "",
      scopes: [CALENDAR_SCOPE],
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
      extraParams: { access_type: "offline", prompt: "consent" },
    },
    discovery,
  );

  const authorize = useCallback(async (): Promise<CalendarGrant | null> => {
    const result = await promptAsync();
    if (result.type !== "success" || !result.params.code || !request?.codeVerifier) {
      return null;
    }
    return {
      code: result.params.code,
      codeVerifier: request.codeVerifier,
      redirectUri,
    };
  }, [promptAsync, request, redirectUri]);

  return { ready: request !== null && isGoogleAuthConfigured(), authorize };
}
