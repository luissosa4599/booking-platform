import { useCallback } from "react";
import { GoogleSignin } from "@react-native-google-signin/google-signin";

import type { GoogleAuth } from "./google.types";

// This package ships its own `.web.d.ts` alongside the default (native)
// `.d.ts` for several exports, same convention as this project's own
// `.native.ts`/`.web.ts` split — but `tsc` has no "target platform" for a
// plain `--noEmit` run, so our project's `moduleSuffixes` ([".ios",
// ".android", ".native", ".web", ""]) picks the FIRST suffix that exists
// for every module resolution, deterministically landing on `.web.d.ts`
// everywhere (it's the only suffixed variant besides the default). That
// makes `GoogleSignin.signIn()` typecheck as the *web* shape
// (`Promise<User>`) even though Metro correctly bundles the real native
// implementation (`Promise<{type, data}>`) for an actual iOS/Android build.
// Declaring the real native shape ourselves sidesteps the false type.
type NativeSignInResponse =
  | { type: "success"; data: { idToken: string | null } }
  | { type: "cancelled"; data: null };

// **iOS/Android only** — see google.ts for why the web browser-redirect flow
// can't be reused here. On native, the ID token's audience is always the
// WEB client: the "Android"/"iOS" OAuth clients in Google Cloud Console are
// only ever used by Play Services / the native SDK to verify the calling
// app (package name + SHA-1 on Android, bundle id on iOS) — they never
// appear in this code.
const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

export function isGoogleAuthConfigured(): boolean {
  return Boolean(webClientId);
}

if (webClientId) {
  GoogleSignin.configure({ webClientId });
}

export function useGoogleAuth(): GoogleAuth {
  const signIn = useCallback(async (): Promise<string | null> => {
    try {
      await GoogleSignin.hasPlayServices();
      const response = (await GoogleSignin.signIn()) as unknown as NativeSignInResponse;
      return response.type === "success" ? response.data.idToken : null;
    } catch (error) {
      if (__DEV__) console.warn("Google sign-in failed", error);
      return null;
    }
  }, []);

  return { ready: isGoogleAuthConfigured(), signIn };
}
