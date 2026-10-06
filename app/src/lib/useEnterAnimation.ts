import { useLayoutEffect, useRef, useState } from "react";
import { Animated, Easing, Platform, type ViewStyle } from "react-native";

import { useReduceMotion } from "./useReduceMotion";

/** Sign-in redesign handoff §8 — the standard curve, `cubic-bezier(0.2, 0, 0, 1)`. */
export const EASE_STANDARD = Easing.bezier(0.2, 0, 0, 1);
/** Handoff §8 — inline errors appear with ease-out `(0, 0, 0.2, 1)`. */
export const EASE_OUT = Easing.bezier(0, 0, 0.2, 1);

interface EnterOptions {
  duration?: number;
  easing?: (value: number) => number;
  /** Starting offset; the element slides from here to its resting place. */
  translateX?: number;
  translateY?: number;
  scale?: number;
  /** Also animate the very first mount (default true). */
  onMount?: boolean;
}

/**
 * Fade (+ optional slide/scale) **in** — replayed every time `key` changes.
 * Exits are instant: the old content is simply gone by the time the new one
 * fades in, which reads as the handoff's cross-fade without having to keep the
 * outgoing tree mounted.
 *
 * Legacy `Animated` from 'react-native', not Reanimated — on web, Reanimated's
 * `Animated.View` drops layout classNames and doesn't reliably paint inside
 * absolute containers (CLAUDE.md "Web animations"); this JS-driven engine just
 * writes `style.opacity`/`transform` every frame. Returns a style for a
 * legacy `Animated.View`. Reduce motion → no animation at all (handoff §8).
 */
export function useEnterAnimation(key: unknown, options: EnterOptions = {}) {
  const {
    duration = 250,
    easing = EASE_STANDARD,
    translateX = 0,
    translateY = 0,
    scale = 1,
    onMount = true,
  } = options;
  const reduceMotion = useReduceMotion();
  const [progress] = useState(() => new Animated.Value(onMount ? 0 : 1));
  const firstRun = useRef(true);

  // Layout effect, not a plain effect: the reset to 0 has to land before the
  // browser/OS paints the new content, or it flashes in fully opaque for a
  // frame before fading.
  useLayoutEffect(() => {
    const isFirst = firstRun.current;
    firstRun.current = false;
    if (reduceMotion || (isFirst && !onMount)) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      easing,
      useNativeDriver: Platform.OS !== "web",
    });
    animation.start();
    return () => animation.stop();
    // Replays on `key` only — the options are fixed per call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reduceMotion]);

  const from = (value: number) => progress.interpolate({ inputRange: [0, 1], outputRange: [value, 0] });
  const transform: Record<string, Animated.AnimatedInterpolation<number>>[] = [];
  if (translateX) transform.push({ translateX: from(translateX) });
  if (translateY) transform.push({ translateY: from(translateY) });
  if (scale !== 1) {
    transform.push({ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [scale, 1] }) });
  }

  return { opacity: progress, transform } as unknown as Animated.WithAnimatedObject<ViewStyle>;
}
