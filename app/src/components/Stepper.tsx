import { Pressable, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { cn } from "@/lib/cn";
import { haptics } from "@/lib/haptics";
import { Minus, Plus } from "@/lib/icons";
import { useReduceMotion } from "@/lib/useReduceMotion";

interface StepperProps {
  value: number;
  min?: number;
  max: number;
  onChange: (value: number) => void;
  /** e.g. "personas" — used to build "Quitar persona" / "Agregar persona"
   * accessibility labels. Falls back to generic "Quitar"/"Agregar" verbs. */
  unitLabel?: string;
}

// Handoff § "6. Stepper" — max = slot.seatsLeft, min = 1. At max, the "+"
// button shakes (4px, 120ms) and gives a warning haptic; no error message.
export function Stepper({ value, min = 1, max, onChange, unitLabel }: StepperProps) {
  "use no memo"; // React Compiler doesn't know Reanimated shared values are safe to mutate.

  const reduceMotion = useReduceMotion();
  const shakeX = useSharedValue(0);

  const shakeStyle = useAnimatedStyle(() => ({
    // `+ 0`, not a bare `.value` read — a bare shared-value read here makes
    // the React Compiler ESLint plugin flag the *write* below as an illegal
    // mutation (same quirk hit with Button/Row in an earlier commit). Must be
    // an inline operator, not a wrapping function call like Math.round() —
    // that still trips the same rule.
    transform: [{ translateX: shakeX.value + 0 }],
  }));

  const canDecrement = value > min;
  const canIncrement = value < max;

  const handleDecrement = () => {
    if (!canDecrement) return;
    haptics.selection();
    onChange(value - 1);
  };

  const handleIncrement = () => {
    if (!canIncrement) {
      shakeX.value = reduceMotion
        ? 0
        : withSequence(
            withTiming(-4, { duration: 30 }),
            withTiming(4, { duration: 30 }),
            withTiming(-4, { duration: 30 }),
            withTiming(0, { duration: 30 }),
          );
      haptics.warning();
      return;
    }
    haptics.selection();
    onChange(value + 1);
  };

  const decrementLabel = unitLabel ? `Quitar ${unitLabel}` : "Quitar";
  const incrementLabel = unitLabel ? `Agregar ${unitLabel}` : "Agregar";

  return (
    <View className="flex-row items-center gap-[2px] rounded-control bg-fill p-[2px]">
      <Pressable
        onPress={handleDecrement}
        disabled={!canDecrement}
        accessibilityRole="button"
        accessibilityLabel={decrementLabel}
        accessibilityState={{ disabled: !canDecrement }}
        hitSlop={{ top: 5, bottom: 5 }}
        className={cn(
          "h-[34px] w-11 items-center justify-center rounded-control-inner bg-card",
          canDecrement ? "text-label-2" : "text-disabled-label",
        )}
      >
        <Minus size={19} />
      </Pressable>

      <Text
        className="w-9 text-center text-[17px] font-semibold text-label-1"
        style={{ fontVariant: ["tabular-nums"] }}
      >
        {value}
      </Text>

      <Animated.View style={shakeStyle}>
        <Pressable
          onPress={handleIncrement}
          accessibilityRole="button"
          accessibilityLabel={incrementLabel}
          accessibilityState={{ disabled: !canIncrement }}
          hitSlop={{ top: 5, bottom: 5 }}
          className="h-[34px] w-11 items-center justify-center rounded-control-inner bg-card text-label-2"
        >
          <Plus size={19} />
        </Pressable>
      </Animated.View>
    </View>
  );
}
