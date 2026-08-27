import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { useReduceMotion } from "@/lib/useReduceMotion";

// A real row shape, not a loading screen — the list never changes shape
// between the loading and loaded states. Never mount this directly; gate it
// with useDelayedFlag(loading, 150) so fast responses never show it at all.
export function Skeleton() {
  "use no memo";

  const reduceMotion = useReduceMotion();
  // Midpoint of the 0.45–0.9 pulse range, not a static 0.45 — a Skeleton
  // that never pulses should still read as "a mid-tone placeholder", not
  // freeze at the pulse's dimmest frame.
  const pulse = useSharedValue(0.675);

  useEffect(() => {
    if (reduceMotion) {
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.9, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.45, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );
  }, [pulse, reduceMotion]);

  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, pulse.value),
  }));

  return (
    <View className="min-h-[56px] flex-row items-center px-4 py-3">
      <View className="flex-1 gap-2">
        <Animated.View style={style} className="h-[13px] w-[48%] rounded-[6px] bg-hairline" />
        <Animated.View style={style} className="h-[11px] w-[30%] rounded-[6px] bg-hairline" />
      </View>
    </View>
  );
}
