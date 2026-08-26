import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { cn } from "@/lib/cn";

export interface SegmentedControlOption {
  label: string;
  value: string;
}

interface SegmentedControlProps {
  options: SegmentedControlOption[];
  value: string;
  onChange: (value: string) => void;
}

const CONTAINER_PADDING = 2;

// Handoff § "5. SegmentedControl": the white pill slides (220ms ease-out) to
// the new position behind the labels — the labels themselves never move,
// and the segment backgrounds never change. Implemented with one absolutely
// positioned View sliding via translateX, not per-segment background swaps.
export function SegmentedControl({
  options,
  value,
  onChange,
}: SegmentedControlProps) {
  "use no memo"; // React Compiler doesn't know Reanimated shared values are safe to mutate.

  const [containerWidth, setContainerWidth] = useState(0);
  const activeIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const segmentWidth =
    containerWidth > 0
      ? (containerWidth - CONTAINER_PADDING * 2) / options.length
      : 0;

  const translateX = useSharedValue(0);

  useEffect(() => {
    translateX.value = withTiming(activeIndex * segmentWidth, {
      duration: 220,
      easing: Easing.out(Easing.ease),
    });
  }, [activeIndex, segmentWidth, translateX]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    width: segmentWidth,
  }));

  return (
    <View
      className="h-[34px] flex-row gap-[2px] rounded-control-segmented bg-fill p-[2px]"
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {containerWidth > 0 ? (
        <Animated.View
          style={[
            pillStyle,
            {
              position: "absolute",
              left: CONTAINER_PADDING,
              top: CONTAINER_PADDING,
              bottom: CONTAINER_PADDING,
            },
          ]}
          className="rounded-control-segmented-inner bg-card"
        />
      ) : null}
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            className="flex-1 items-center justify-center"
          >
            <Text
              className={cn(
                "text-[15px]",
                isActive
                  ? "font-semibold text-label-1"
                  : "font-medium text-label-3",
              )}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
