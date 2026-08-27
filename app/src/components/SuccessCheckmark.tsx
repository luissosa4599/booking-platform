import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { haptics } from "@/lib/haptics";
import { Check } from "@/lib/icons";
import { useReduceMotion } from "@/lib/useReduceMotion";

// Handoff § "04 · ConfirmedScreen" microinteraction — circle + halo. Exact
// spec (handoff's own "Interactions & Behavior" table + Reanimated hint):
// - Checkmark: scale 0.6 → 1.06 → 1 in 340ms, opacity 0 → 1 over the first
//   55% (~187ms) — `withSequence(withTiming(1.06, {duration:190}),
//   withSpring(1))`.
// - Halo: 104px circle, scale 0.9 → 1.6, opacity 0.5 → 0, 2s, ease-out, loop.
// Previously shipped static because this exact pattern (a shared value read
// bare inside useAnimatedStyle, under `experiments.reactCompiler: true`)
// crashed the app on web with no stack trace — see docs/session-log.md,
// Commit 12 § 7. Restored, then brought in line with the exact spec above
// (an earlier pass approximated the curve with a generic spring).
export function SuccessCheckmark() {
  "use no memo"; // React Compiler doesn't know Reanimated shared values are safe to mutate.

  const reduceMotion = useReduceMotion();
  const scale = useSharedValue(0.6);
  const opacity = useSharedValue(0);
  const haloProgress = useSharedValue(0);

  useEffect(() => {
    haptics.success();
    if (reduceMotion) {
      scale.value = 1;
      opacity.value = 1;
      // No infinite halo loop under reduce motion — its opacity sits at the
      // low end of its own range instead of stopping mid-pulse at 0.
      haloProgress.value = 0;
      return;
    }
    scale.value = withSequence(withTiming(1.06, { duration: 190 }), withSpring(1));
    opacity.value = withTiming(1, { duration: 187 });
    haloProgress.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.out(Easing.ease) }),
      -1,
      false,
    );
  }, [scale, opacity, haloProgress, reduceMotion]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.5 - haloProgress.value * 0.5,
    transform: [{ scale: 0.9 + haloProgress.value * 0.7 }],
  }));

  return (
    <Animated.View
      style={containerStyle}
      className="h-[104px] w-[104px] items-center justify-center"
    >
      <Animated.View
        style={haloStyle}
        className="absolute h-[104px] w-[104px] rounded-full bg-tint-wash"
      />
      <View className="h-[84px] w-[84px] items-center justify-center rounded-full bg-tint text-on-tint">
        <Check size={40} strokeWidth={3} />
      </View>
    </Animated.View>
  );
}
