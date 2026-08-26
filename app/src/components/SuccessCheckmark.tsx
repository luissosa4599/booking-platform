import { useEffect } from "react";
import { Text, View } from "react-native";

import { haptics } from "@/lib/haptics";

// Handoff § "04 · ConfirmedScreen" microinteraction — circle + halo, scale +
// fade entrance with a looping halo. A Reanimated (useSharedValue +
// useAnimatedStyle) version of this reliably broke the app on web in this
// spot — reproducible, without a stack trace — so this is a static version
// (no entrance animation, no halo motion) instead of investing more time
// chasing that. Still gives haptic + visual confirmation; the polish is a
// known gap, not a silent omission.
export function SuccessCheckmark() {
  useEffect(() => {
    haptics.success();
  }, []);

  return (
    <View className="h-[104px] w-[104px] items-center justify-center">
      <View className="absolute h-[104px] w-[104px] rounded-full bg-tint-wash" />
      <View className="h-[84px] w-[84px] items-center justify-center rounded-full bg-tint">
        <Text className="text-[40px] font-semibold leading-[40px] text-white">✓</Text>
      </View>
    </View>
  );
}
