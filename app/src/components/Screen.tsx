import type { ReactNode } from "react";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { useColor } from "@/lib/theme/useColor";
import { ScreenFade } from "./ScreenFade";

type ScreenBg = "canvas" | "card";

interface ScreenProps {
  children: ReactNode;
  /** The screen's ground colour. `canvas` (default) or `card`. */
  bg?: ScreenBg;
  /**
   * Which edges get safe-area padding. Default `["top"]` — the tabbed screens
   * only need the status bar handled (the TabBar owns `insets.bottom`).
   * A screen with its own bottom CTA passes `["top", "bottom"]`; the
   * resource-detail hero, which goes edge-to-edge under the status bar,
   * doesn't use this component.
   */
  edges?: readonly Edge[];
}

/**
 * The standard screen shell: safe-area handling + the ground colour, both in
 * one place instead of per-screen `insets.top + N` arithmetic.
 *
 * **Theme-flash**: the background is painted here from the outermost element
 * (not left to a child `View`), and via `useColor` so it re-renders on a
 * light/dark switch. Together with the Stack's `contentStyle` and the native
 * window background (app.config.ts `backgroundColor`) that's three layers of
 * the same colour — a theme change can't reveal a stale/transparent gap
 * mid-transition. See CLAUDE.md "Safe area + theme-flash".
 */
export function Screen({
  children,
  bg = "canvas",
  edges = ["top"],
}: ScreenProps) {
  const color = useColor(bg);
  return (
    <ScreenFade>
      <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: color }}>
        {children}
      </SafeAreaView>
    </ScreenFade>
  );
}
