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
export function ScreenFade({ children }: { children: ReactNode }) {
  const isWide = useIsWide();
  // `useState`'s lazy initializer (not `useRef().current`) avoids tripping
  // react-hooks/refs — see lib/useFadeTransition.ts for the same pattern.
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = Animated.timing(opacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  // Phone: the original 420px centred column (handoff § "Cross-platform").
  // Tablet/desktop (PR #11): full width — the nav rail + each screen's own
  // layout take over the width budget. The bg-canvas backdrop still fills any
  // letterboxed margin; legacy Animated.View doesn't apply NativeWind colour
  // classes, so it goes on a plain View, not the Animated.View itself.
  return (
    <Animated.View style={{ flex: 1, opacity }}>
      <View className="flex-1 bg-canvas">
        <View
          className={
            isWide ? "w-full flex-1" : "mx-auto w-full max-w-[420px] flex-1"
          }
        >
          {children}
        </View>
      </View>
    </Animated.View>
  );
}
