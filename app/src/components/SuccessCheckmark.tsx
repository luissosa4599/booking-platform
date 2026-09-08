import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { haptics } from "@/lib/haptics";
import { Check } from "@/lib/icons";
import { useColor } from "@/lib/theme/useColor";
import { useReduceMotion } from "@/lib/useReduceMotion";

// Handoff § "04 · ConfirmedScreen" microinteraction — circle + halo. Exact
// spec (handoff's own "Interactions & Behavior" table + Reanimated hint):
// - Checkmark: scale 0.6 → 1.06 → 1 in 340ms, opacity 0 → 1 over the first
//   55% (~187ms) — `withSequence(withTiming(1.06, {duration:190}),
//   withSpring(1))`.
// - Halo: the handoff calls for one 2s expanding ring. Extended here to three
//   staggered rings (a ripple) — requested while testing the become-host flow;
//   a strict superset of the spec'd single ring.
// Previously shipped static because this exact pattern (a shared value read
// bare inside useAnimatedStyle, under `experiments.reactCompiler: true`)
// crashed the app on web with no stack trace — see docs/session-log.md,
// Commit 12 § 7.
const RIPPLE_COUNT = 3;
const RIPPLE_PERIOD = 2200;

export function SuccessCheckmark() {
  "use no memo"; // React Compiler doesn't know Reanimated shared values are safe to mutate.

  const reduceMotion = useReduceMotion();
  const onTintColor = useColor("on-tint");
  const scale = useSharedValue(0.6);
  const opacity = useSharedValue(0);

  useEffect(() => {
    haptics.success();
    if (reduceMotion) {
      scale.value = 1;
      opacity.value = 1;
      return;
    }
    scale.value = withSequence(withTiming(1.06, { duration: 190 }), withSpring(1));
    opacity.value = withTiming(1, { duration: 187 });
  }, [scale, opacity, reduceMotion]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={containerStyle}
      className="h-[104px] w-[104px] items-center justify-center"
    >
      {Array.from({ length: RIPPLE_COUNT }).map((_, i) => (
        <RippleRing key={i} index={i} reduceMotion={reduceMotion} />
      ))}
      <View className="h-[84px] w-[84px] items-center justify-center rounded-full bg-tint text-on-tint">
        <Check size={40} strokeWidth={3} color={onTintColor} />
      </View>
    </Animated.View>
  );
}

function RippleRing({
  index,
  reduceMotion,
}: {
  index: number;
  reduceMotion: boolean;
}) {
  "use no memo";

  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      return;
    }
    progress.value = withDelay(
      (index * RIPPLE_PERIOD) / RIPPLE_COUNT,
      withRepeat(
        withTiming(1, { duration: RIPPLE_PERIOD, easing: Easing.out(Easing.ease) }),
        -1,
        false,
      ),
    );
  }, [progress, index, reduceMotion]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.45 - progress.value * 0.45,
    transform: [{ scale: 0.85 + progress.value * 0.8 }],
  }));

  return (
    <Animated.View
      style={style}
      className="absolute h-[104px] w-[104px] rounded-full bg-tint-wash"
    />
  );
}
