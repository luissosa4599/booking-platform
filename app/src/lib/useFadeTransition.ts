import { useEffect, useState } from "react";
import { Animated } from "react-native";

// Web-only helper for a JS-driven fade (legacy `Animated` from 'react-native',
// not Reanimated): `Animated.View` from `react-native-reanimated` doesn't
// paint reliably as a descendant of an edge-anchored `position: absolute`
// container on web (see docs/session-log.md), and Tailwind's `transition-*`/
// `duration-*`/`scale-*` utilities aren't part of NativeWind's generated CSS
// here (verified: zero matching rules in the exported web bundle) — so a
// className-based CSS transition silently does nothing. Legacy `Animated`
// sidesteps both: it drives the `opacity`/`transform` style values directly
// every frame via JS, independent of Tailwind and of Reanimated's web
// backend.
export function useFadeTransition(isOpen: boolean, durationMs: number) {
  const [mounted, setMounted] = useState(isOpen);
  // `useState`'s lazy initializer (not `useRef().current`) creates this once
  // without tripping react-hooks/refs' "no ref access during render" — `"use
  // no memo"` (used elsewhere in this codebase for Reanimated) doesn't
  // suppress that particular rule.
  const [opacity] = useState(() => new Animated.Value(isOpen ? 1 : 0));

  if (isOpen && !mounted) {
    setMounted(true);
  }

  useEffect(() => {
    const animation = Animated.timing(opacity, {
      toValue: isOpen ? 1 : 0,
      duration: durationMs,
      useNativeDriver: false,
    });
    animation.start(({ finished }) => {
      if (finished && !isOpen) {
        setMounted(false);
      }
    });
    return () => animation.stop();
  }, [isOpen, durationMs, opacity]);

  return { mounted, opacity };
}
