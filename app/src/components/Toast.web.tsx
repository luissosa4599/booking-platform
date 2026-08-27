import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";

import { useFadeTransition } from "@/lib/useFadeTransition";

import type { ToastProps } from "./Toast.types";

const TRANSITION_MS = 200;

// Not one of the "componentes faltantes" the task named, but the booking
// interaction spec requires a bottom toast with an action — built minimal
// and non-reusable-beyond-this-shape on purpose, not a full design-system piece.
//
// Legacy `Animated` (from 'react-native', not Reanimated) via
// `useFadeTransition` — see that file for why: an `Animated.View` from
// `react-native-reanimated` doesn't paint reliably here on web (it's a
// descendant of this edge-anchored `position: absolute` container), and
// Tailwind's `transition-*` utilities turned out not to be part of this
// project's generated CSS either. `Toast.native.tsx` still uses Reanimated
// `entering`/`exiting` — that bug never reproduced on native.
export function Toast({
  isOpen,
  message,
  actionLabel,
  onAction,
  onDismiss,
  durationMs = 4000,
}: ToastProps) {
  const { mounted, opacity } = useFadeTransition(isOpen, TRANSITION_MS);
  const translateY = opacity.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });

  // The parent clears `message` to "" the same render it flips `isOpen` to
  // false — keep showing the last real message through the exit transition
  // instead of flashing an empty toast. Derived directly during render (not
  // an effect, not a ref mutation): a plain state update guarded to only
  // fire when there's a new real message to show.
  const [displayMessage, setDisplayMessage] = useState(message);
  if (message && message !== displayMessage) {
    setDisplayMessage(message);
  }

  // `onDismiss` is a fresh inline function on every parent render (it's not
  // memoized) — depending on it directly would reschedule this timer on every
  // parent re-render instead of once per toast. A ref keeps the callback
  // current without that; the effect itself only depends on what should
  // actually restart the countdown: a new message, or a new duration.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const timeout = setTimeout(() => onDismissRef.current(), durationMs);
    return () => clearTimeout(timeout);
  }, [isOpen, message, durationMs]);

  if (!mounted) {
    return null;
  }

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: 16,
        right: 16,
        bottom: 24,
        opacity,
        transform: [{ translateY }],
      }}
    >
      {/* Color/shape utilities (bg-label-1, text-white, rounded-[14px]) go on
          a plain View, not the Animated.View above — NativeWind's CSS-var
          color classes (rgb(var(--color-x) / <alpha-value>)) silently don't
          apply when the className is on `Animated.View` from 'react-native'
          itself (confirmed: computed backgroundColor stayed transparent).
          Same split `Sheet.web.tsx` already uses. */}
      {/* Fixed dark surface, not the theme-reactive `bg-label-1` token —
          `label-1` flips to white in dark mode, which would have put white
          text on a white toast. A toast is conventionally an always-dark
          pill regardless of the app's own light/dark mode. */}
      <View className="flex-row items-center justify-between rounded-[14px] bg-[#1C1C1E] px-4 py-3">
        <Text className="text-body flex-1 text-white" numberOfLines={1}>
          {displayMessage}
        </Text>
        {actionLabel && onAction ? (
          <Pressable
            onPress={onAction}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            className="ml-3"
          >
            <Text className="text-body-emph text-tint-soft">{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}
