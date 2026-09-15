import { useRef, useState } from "react";
import type { GestureResponderEvent, LayoutChangeEvent, View as ViewType } from "react-native";
import { View } from "react-native";

import { useColor } from "@/lib/theme/useColor";
import { SliderProps, TRACK_HEIGHT, THUMB_SIZE } from "./Slider.types";

/**
 * Native implementation — RN's core Responder System (not
 * react-native-gesture-handler/Reanimated, see `Slider.web.tsx`'s file
 * comment for why the web side can't use this same approach). A real touch
 * device's touch events drive `onResponderMove` correctly (this is the
 * standard, long-established way to build a custom RN slider); it's
 * react-native-web's polyfill of the same API that doesn't fire it for a
 * mouse drag, which is why web gets its own file instead.
 *
 * Uses `pageX` + a `measure()`'d container position rather than
 * `nativeEvent.locationX`, which on native is relative to whichever nested
 * node the touch is currently over — same reasoning as the web file, kept
 * here for consistency even though it's less observable on native.
 */
export function Slider({ min, max, value, onChange, step = 1, disabled, accessibilityLabel }: SliderProps) {
  const containerRef = useRef<ViewType>(null);
  const containerPageX = useRef(0);
  const [trackWidth, setTrackWidth] = useState(0);
  const tint = useColor("tint");
  const fillColor = useColor("fill");
  const cardColor = useColor("card");

  const usableWidth = Math.max(0, trackWidth - THUMB_SIZE);
  const clampValue = (v: number) => Math.min(max, Math.max(min, v));
  const snap = (v: number) => Math.round(v / step) * step;

  const valueFromPageX = (pageX: number) => {
    if (usableWidth <= 0) return value;
    const localX = pageX - containerPageX.current;
    const ratio = Math.min(1, Math.max(0, (localX - THUMB_SIZE / 2) / usableWidth));
    return clampValue(snap(min + ratio * (max - min)));
  };

  const handleLayout = (e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
    containerRef.current?.measure((_x, _y, _w, _h, pageX) => {
      containerPageX.current = pageX;
    });
  };

  const handleTouch = (evt: GestureResponderEvent) => {
    if (disabled) return;
    onChange(valueFromPageX(evt.nativeEvent.pageX));
  };

  const percent = max > min ? (clampValue(value) - min) / (max - min) : 0;
  const thumbLeft = THUMB_SIZE / 2 + percent * usableWidth;

  return (
    <View
      ref={containerRef}
      onLayout={handleLayout}
      style={{ height: THUMB_SIZE, justifyContent: "center" }}
      onStartShouldSetResponder={() => !disabled}
      onMoveShouldSetResponder={() => !disabled}
      onResponderGrant={handleTouch}
      onResponderMove={handleTouch}
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, now: value }}
    >
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
        style={{
          position: "absolute",
          left: thumbLeft - THUMB_SIZE / 2,
          width: THUMB_SIZE,
          height: THUMB_SIZE,
          borderRadius: THUMB_SIZE / 2,
          backgroundColor: cardColor,
          borderWidth: 3,
          borderColor: disabled ? fillColor : tint,
          shadowColor: "#0B0B0C",
          shadowOpacity: 0.2,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
          elevation: 3,
        }}
      />
    </View>
  );
}
