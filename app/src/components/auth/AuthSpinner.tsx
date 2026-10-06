import { useEffect, useState } from "react";
import { Animated, Easing, Platform } from "react-native";

import { LoaderCircle } from "@/lib/icons";
import { useReduceMotion } from "@/lib/useReduceMotion";

/**
 * Handoff §8 — `LoaderCircle`, one turn every 800 ms, linear. With reduce
 * motion it stays still; the button's "Entrando…" label already says what's
 * happening. Legacy `Animated` (works the same on web and native).
 */
export function AuthSpinner({ color, size = 20 }: { color: string; size?: number }) {
  const reduceMotion = useReduceMotion();
  const [turn] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.timing(turn, {
        toValue: 1,
        duration: 800,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== "web",
      }),
    );
    loop.start();
    return () => {
      loop.stop();
      turn.setValue(0);
    };
  }, [reduceMotion, turn]);

  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return (
    <Animated.View style={{ transform: [{ rotate }] }} importantForAccessibility="no-hide-descendants">
      <LoaderCircle size={size} color={color} strokeWidth={2} />
    </Animated.View>
  );
}
