import { View, type ViewStyle } from "react-native";

import { useColor } from "@/lib/theme/useColor";
import { SliderProps, TRACK_HEIGHT, THUMB_SIZE } from "./Slider.types";

/**
 * Web implementation — an invisible native `<input type="range">` overlaid
 * on our own themed track/thumb visual, not a hand-rolled drag gesture.
 *
 * Tried react-native-web's Responder System first (`onResponderMove`, the
 * same API `Slider.native.tsx` uses) and confirmed via an instrumented
 * handler that it **never fires a single move event for a mouse drag** in
 * this project's RNW setup — only the initial `onResponderGrant` at
 * mousedown runs, so the thumb only ever reflected where the drag *started*,
 * never where it moved to. This is a real RNW gap, not a bug in the ratio
 * math (confirmed by logging raw event coordinates). The browser's own
 * `<input type="range">` needs none of that — real drag, click-to-jump, and
 * keyboard support for free — so it does the interaction while our View
 * underneath (pointerEvents "none") does the visuals, matching the app's
 * design instead of the browser's default slider chrome.
 */
export function Slider({ min, max, value, onChange, step = 1, disabled, accessibilityLabel }: SliderProps) {
  const tint = useColor("tint");
  const fillColor = useColor("fill");
  const cardColor = useColor("card");

  const clamped = Math.min(max, Math.max(min, value));
  const percent = max > min ? (clamped - min) / (max - min) : 0;

  return (
    <View style={{ height: THUMB_SIZE, justifyContent: "center" }}>
      <View
        style={{
          marginHorizontal: THUMB_SIZE / 2,
          height: TRACK_HEIGHT,
          borderRadius: TRACK_HEIGHT / 2,
          backgroundColor: fillColor,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            height: "100%",
            width: `${percent * 100}%`,
            backgroundColor: disabled ? fillColor : tint,
          }}
        />
      </View>
      <View
        pointerEvents="none"
        style={
          {
            position: "absolute",
            // Thumb's own top-left corner — its center sits at
            // THUMB_SIZE/2 + percent * (100% - THUMB_SIZE), so the corner is
            // that minus THUMB_SIZE/2, which cancels down to this.
            left: `calc(${percent} * (100% - ${THUMB_SIZE}px))`,
            width: THUMB_SIZE,
            height: THUMB_SIZE,
            borderRadius: THUMB_SIZE / 2,
            backgroundColor: cardColor,
            borderWidth: 3,
            borderColor: disabled ? fillColor : tint,
            boxShadow: "0 2px 4px rgba(11,11,12,0.2)",
          } as unknown as ViewStyle
        }
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={clamped}
        disabled={disabled}
        aria-label={accessibilityLabel}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
        onInput={(e) => onChange(Number((e.target as HTMLInputElement).value))}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          margin: 0,
          opacity: 0,
          cursor: disabled ? "default" : "pointer",
        }}
      />
    </View>
  );
}
