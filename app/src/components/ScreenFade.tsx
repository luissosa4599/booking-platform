import type { ReactNode } from "react";

// Native (iOS/Android): pass through untouched. `Stack`'s own `animation`
// screenOption already gives a real platform-native transition there — see
// ScreenFade.web.tsx for why web needs a separate mechanism.
export function ScreenFade({
  children,
}: {
  children: ReactNode;
  /** Web-only (see ScreenFade.web.tsx); ignored on native. */
  fluid?: boolean;
}) {
  return <>{children}</>;
}
