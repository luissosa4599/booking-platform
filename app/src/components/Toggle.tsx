import { useEffect, useState } from "react";
import { Animated, Easing, Pressable } from "react-native";

import { haptics } from "@/lib/haptics";
import { useColor } from "@/lib/theme/useColor";
import { useReduceMotion } from "@/lib/useReduceMotion";

interface ToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}

// Handoff § "Nuevos (2) · Toggle" — a persistent per-row on/off switch (the
// weekly-schedule editor needs 7). Track 51x31, knob 27, 200ms
// cubic-bezier(.32,.72,0,1). Legacy Animated (JS-driven) so it paints reliably
// on web too — same reasoning as the other animated components in this app.
const TRACK_W = 51;
const TRACK_H = 31;
const KNOB = 27;
const TRAVEL = TRACK_W - KNOB - 4;

export function Toggle({
  value,
  onChange,
  disabled = false,
  accessibilityLabel,
}: ToggleProps) {
  const reduceMotion = useReduceMotion();
  const onTrack = useColor("tint");
  const offTrack = useColor("fill");
  const onKnob = "#FFFFFF";
  const offKnob = useColor("card");

  const [progress] = useState(() => new Animated.Value(value ? 1 : 0));

  useEffect(() => {
    Animated.timing(progress, {
      toValue: value ? 1 : 0,
      duration: reduceMotion ? 0 : 200,
      easing: Easing.bezier(0.32, 0.72, 0, 1),
      useNativeDriver: false,
    }).start();
  }, [value, progress, reduceMotion]);

  const trackColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [offTrack, onTrack],
  });
  const knobColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [offKnob, onKnob],
  });
  const knobX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, TRAVEL],
  });

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      onPress={() => {
        haptics.selection();
        onChange(!value);
      }}
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      <Animated.View
        style={{
          width: TRACK_W,
          height: TRACK_H,
          borderRadius: TRACK_H / 2,
          backgroundColor: trackColor,
          justifyContent: "center",
          paddingHorizontal: 2,
        }}
      >
        <Animated.View
          style={{
            width: KNOB,
            height: KNOB,
            borderRadius: KNOB / 2,
            backgroundColor: knobColor,
            transform: [{ translateX: knobX }],
          }}
        />
      </Animated.View>
    </Pressable>
  );
}
