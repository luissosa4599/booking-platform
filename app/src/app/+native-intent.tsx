/**
 * Native-only hook into expo-router's deep-link handling.
 *
 * The Google Calendar consent flow ends with the web bridge
 * (auth/calendar-bridge.tsx) sending `app://?code=...&state=...` back into the
 * app. lib/auth/googleCalendar.ts picks that url up itself through its own
 * Linking listener — but expo-router would also see it as a link to "/" and
 * yank the user from wherever they started (the Confirmed screen, Tú) to
 * Explore mid-flow. Swallow it instead.
 */
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  if (isOAuthCallback(path)) {
    // A cold start from the callback means the app was killed while the
    // browser was open — the flow that was waiting for it is gone anyway.
    return initial ? "/" : null;
  }
  return path;
}

function isOAuthCallback(path: string): boolean {
  return /[?&]state=/.test(path) && /[?&](code|error)=/.test(path);
}
