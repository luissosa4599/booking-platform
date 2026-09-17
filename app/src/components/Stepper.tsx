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
import { useColor } from "@/lib/theme/useColor";
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
  const glyphColor = useColor("label-2");
  const disabledGlyphColor = useColor("disabled-label");
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
      {/* §4 point 5 — bumped from 34px to the 44px touch-target floor (the
          slot-list Row's own min-h-[56px] already cleared it; the stepper
          didn't visually, even though hitSlop compensated). §4 point 2 —
          radius bumped from rounded-control-inner (8) to rounded-button (14). */}
      <Pressable
        onPress={handleDecrement}
        disabled={!canDecrement}
        accessibilityRole="button"
        accessibilityLabel={decrementLabel}
        accessibilityState={{ disabled: !canDecrement }}
        className={cn(
          "h-11 w-11 items-center justify-center rounded-button bg-card",
          canDecrement ? "text-label-2" : "text-disabled-label",
        )}
      >
        <Minus size={19} color={canDecrement ? glyphColor : disabledGlyphColor} />
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
          className="h-11 w-11 items-center justify-center rounded-button bg-card text-label-2"
        >
          <Plus size={19} color={glyphColor} />
        </Pressable>
      </Animated.View>
    </View>
  );
}
