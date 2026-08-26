import type { ReactNode } from "react";

// Native (iOS/Android): pass through untouched. `Stack`'s own `animation`
// screenOption already gives a real platform-native transition there — see
// ScreenFade.web.tsx for why web needs a separate mechanism.
export function ScreenFade({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
