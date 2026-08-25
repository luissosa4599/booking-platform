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

// A real row shape, not a loading screen — the list never changes shape
// between the loading and loaded states. Never mount this directly; gate it
// with useDelayedFlag(loading, 150) so fast responses never show it at all.
export function Skeleton() {
  "use no memo";

  const pulse = useSharedValue(0.45);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.9, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.45, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );
  }, [pulse]);

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
