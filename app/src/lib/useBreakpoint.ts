import { useWindowDimensions } from "react-native";

/**
 * Layout breakpoints for the responsive shell (PR #11).
 *
 * - `phone`   (<768)  — one column, bottom TabBar. The app's original form;
 *   unchanged.
 * - `tablet`  (768–1199) — a collapsed nav rail replaces the TabBar; the
 *   detail screen still pushes as a route.
 * - `desktop` (>=1200) — nav rail + a persistent detail pane. The list keys the
 *   pane off `?sel=<id>` and never unmounts, so it keeps refreshing.
 *
 * Width-based (matches NativeWind's own `md:`/`lg:` and `useWindowDimensions`).
 * A phone held in landscape can read as `tablet` — acceptable; the wide layouts
 * degrade to a wider single column, not something broken. Verified on web only
 * (no device/emulator here — see CLAUDE.md); native tablet behaviour is
 * code-review until there's a build.
 */
export type Breakpoint = "phone" | "tablet" | "desktop";

export const TABLET_MIN = 768;
export const DESKTOP_MIN = 1200;

export function useBreakpoint(): Breakpoint {
  const { width } = useWindowDimensions();
  if (width >= DESKTOP_MIN) return "desktop";
  if (width >= TABLET_MIN) return "tablet";
  return "phone";
}

/** True at `tablet` or `desktop` — i.e. the nav rail is showing, not the TabBar. */
export function useIsWide(): boolean {
  return useBreakpoint() !== "phone";
}

/** True only at `desktop` — the persistent detail pane is available. */
export function useHasDetailPane(): boolean {
  return useBreakpoint() === "desktop";
}
