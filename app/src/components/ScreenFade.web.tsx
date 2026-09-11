import { useEffect, useState, type ReactNode } from "react";
import { Animated, View } from "react-native";

import { useIsWide } from "@/lib/useBreakpoint";

// `Stack`'s `animation` screenOption is documented Android-only — confirmed
// empirically too (screenshots at t+0/30/60/150/300ms after navigating showed
// the destination screen fully painted from the first frame either way).
// Expo Router's native-stack has no built-in web transition. This fades each
// screen's content in on its own mount instead — not a real cross-fade
// between outgoing/incoming screens (native-stack still swaps those
// instantly), but real motion instead of a hard cut.
//
// Legacy `Animated` (from 'react-native'), not Reanimated's `entering` — see
// `lib/useFadeTransition.ts` for why: Reanimated's web backend and
// NativeWind's generated CSS both turned out not to reliably drive this kind
// of transition in this project.
export function ScreenFade({
  children,
  fluid = false,
}: {
  children: ReactNode;
  /** Skip the centred column cap on wide viewports — for the tool screens
   * (Explore, Bookings, Spaces) that run their own nav-rail + pane layout. */
  fluid?: boolean;
}) {
  const isWide = useIsWide();
  // `useState`'s lazy initializer (not `useRef().current`) avoids tripping
  // react-hooks/refs — see lib/useFadeTransition.ts for the same pattern.
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = Animated.timing(opacity, {
      toValue: 1,
      // Was 180ms — the user found the web app's transitions read as
      // "fast-forward" after using it live; bumped for perceptibility
      // (2026-09-11 punch-list item 4). 300ms sits at the low end of the
      // standard screen-transition band (Material Design 3's "transitions"
      // category: 300-700ms; general UX guidance for modals/panels/page
      // transitions: 300-500ms). Web-only, so native (unverified on a
      // device) is untouched.
      duration: 300,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  // Phone: the original 420px centred column (handoff § "Cross-platform").
  // Wide (PR #11): document screens (detail, forms, confirmed) stay a centred
  // 760 column; the `fluid` tool screens go full width and run their own
  // nav-rail + pane layout. The bg-canvas backdrop fills any letterboxed
  // margin; legacy Animated.View doesn't apply NativeWind colour classes, so
  // it goes on a plain View, not the Animated.View itself.
  // Inline maxWidth, not a `max-w-[Npx]` class — NativeWind's arbitrary
  // max-width utilities have been unreliable on web in this project (see the
  // reverted 2-column Group attempt in the session log).
  const maxWidth = !isWide ? 420 : fluid ? undefined : 760;
  return (
    <Animated.View style={{ flex: 1, opacity }}>
      <View className="flex-1 bg-canvas">
        <View
          style={{
            flex: 1,
            width: "100%",
            maxWidth,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          {children}
        </View>
      </View>
    </Animated.View>
  );
}
