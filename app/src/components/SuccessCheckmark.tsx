import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { haptics } from "@/lib/haptics";

// Handoff § "04 · ConfirmedScreen" microinteraction — circle + halo, scale +
// fade entrance with a looping halo ripple. Previously shipped static
// because this exact pattern (a shared value read bare inside
// useAnimatedStyle, under `experiments.reactCompiler: true`) crashed the
// app on web with no stack trace — see docs/session-log.md, Commit 12 § 7.
// Restored (and completed — the entrance was still missing) after
// confirming the crash disappears with reactCompiler off.
export function SuccessCheckmark() {
  "use no memo"; // React Compiler doesn't know Reanimated shared values are safe to mutate.

  const enter = useSharedValue(0);
  const haloProgress = useSharedValue(0);

  useEffect(() => {
    haptics.success();
    enter.value = withSpring(1, { damping: 14, stiffness: 180 });
    haloProgress.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.out(Easing.ease) }),
      -1,
      false,
    );
  }, [enter, haloProgress]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ scale: 0.6 + enter.value * 0.4 }],
  }));

  // Ripple: grows and fades out together, then snaps back to restart —
  // fading it out first hides the snap instead of showing an abrupt resize.
  const haloStyle = useAnimatedStyle(() => ({
    opacity: (1 - haloProgress.value) * 0.6,
    transform: [{ scale: 1 + haloProgress.value * 0.5 }],
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
      <View className="h-[84px] w-[84px] items-center justify-center rounded-full bg-tint">
        <Text className="text-[40px] font-semibold leading-[40px] text-white">✓</Text>
      </View>
    </Animated.View>
  );
}
