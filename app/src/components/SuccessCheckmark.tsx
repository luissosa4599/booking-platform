import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { haptics } from "@/lib/haptics";

// Handoff § "04 · ConfirmedScreen" microinteraction — circle + halo, looping
// scale on the halo. Previously shipped static because this exact pattern
// (a shared value read bare inside useAnimatedStyle, under
// `experiments.reactCompiler: true`) crashed the app on web with no stack
// trace — see docs/session-log.md, Commit 12 § 7. Restored after confirming
// the crash disappears with reactCompiler off (verified via a real headless-
// browser run of the booking flow: zero page/console errors).
export function SuccessCheckmark() {
  const haloScale = useSharedValue(1);

  useEffect(() => {
    haptics.success();
    haloScale.value = withRepeat(withTiming(1.3, { duration: 900 }), -1, false);
  }, [haloScale]);

  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: haloScale.value + 0 }],
  }));

  return (
    <View className="h-[104px] w-[104px] items-center justify-center">
      <Animated.View
        style={haloStyle}
        className="absolute h-[104px] w-[104px] rounded-full bg-tint-wash"
      />
      <View className="h-[84px] w-[84px] items-center justify-center rounded-full bg-tint">
        <Text className="text-[40px] font-semibold leading-[40px] text-white">✓</Text>
      </View>
    </View>
  );
}
