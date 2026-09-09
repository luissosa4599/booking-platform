import type { ReactNode } from "react";
import { View } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { useColor } from "@/lib/theme/useColor";
import { useIsWide } from "@/lib/useBreakpoint";
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
  /**
   * On wide viewports (PR #11), cap the content to this width and left-align it
   * against the nav rail. For a list column that should be narrower than the
   * `fluid` area — e.g. 1080 for Bookings. Ignored on phone.
   */
  maxWidth?: number;
  /**
   * Skip `ScreenFade`'s centred 760 column on wide — for the tool screens
   * (Explore, Bookings, Spaces) that fill the width with their own nav-rail +
   * detail-pane layout. Document screens (detail, forms) omit this.
   */
  fluid?: boolean;
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
  maxWidth,
  fluid = false,
}: ScreenProps) {
  const color = useColor(bg);
  const isWide = useIsWide();
  // Left-aligned against the nav rail, not floated in the centre — the app
  // reads as one workspace. On desktop the empty right side is where a detail
  // pane lands (Explore, Bookings); on a reading column (profile) it just
  // stays a flush-left column.
  const capped =
    isWide && maxWidth ? (
      <View style={{ flex: 1, width: "100%", maxWidth, alignSelf: "flex-start" }}>
        {children}
      </View>
    ) : (
      children
    );
  return (
    <ScreenFade fluid={fluid}>
      <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: color }}>
        {capped}
      </SafeAreaView>
    </ScreenFade>
  );
}
