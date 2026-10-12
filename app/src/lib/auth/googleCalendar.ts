import { useCallback } from "react";
import { Linking, Platform } from "react-native";
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

// What the bridge actually hands control back with: `app://?code=...&state=...`.
// `promptAsync()` can't be used on native — it tells expo-web-browser to watch
// for the *redirect* URI (the https bridge), and on Android (no native auth
// session there, a polyfill) a callback only counts as "success" when the
// incoming Linking url startsWith that. `app://...` never did, so the Custom Tab
// closing won the race as "dismiss" and every attempt read as a silent cancel.
// iOS's ASWebAuthenticationSession also keys on the callback scheme, so the
// same return URL is right there too. `+native-intent.tsx` keeps expo-router
// from also treating this callback as a navigation to "/".
const NATIVE_RETURN_URL = "app://";

// If Android delivers "app became active" before the callback url (normally
// it's the other way round), give the url this long to show up.
const LATE_CALLBACK_GRACE_MS = 750;

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
    if (!request?.codeVerifier) return null;
    const result =
      Platform.OS === "web" ? await promptAsync() : await promptNative(request);
    if (result?.type !== "success" || !result.params.code) return null;
    return {
      code: result.params.code,
      codeVerifier: request.codeVerifier,
      redirectUri,
    };
  }, [promptAsync, request, redirectUri]);

  return { ready: request !== null && isGoogleAuthConfigured(), authorize };
}

async function promptNative(
  request: AuthSession.AuthRequest,
): Promise<AuthSession.AuthSessionResult | null> {
  if (!request.url) return null;
  let callbackUrl: string | null = null;
  let onCallback: (() => void) | null = null;
  const subscription = Linking.addEventListener("url", ({ url }) => {
    if (!url.startsWith(NATIVE_RETURN_URL)) return;
    callbackUrl = url;
    onCallback?.();
  });
  try {
    const result = await WebBrowser.openAuthSessionAsync(request.url, NATIVE_RETURN_URL);
    if (result.type === "success") return request.parseReturnUrl(result.url);
    if (result.type === "dismiss" && !callbackUrl) {
      await new Promise<void>((resolve) => {
        onCallback = resolve;
        setTimeout(resolve, LATE_CALLBACK_GRACE_MS);
      });
    }
    return callbackUrl ? request.parseReturnUrl(callbackUrl) : null;
  } finally {
    subscription.remove();
  }
}
