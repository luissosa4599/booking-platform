import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, Text } from "react-native";

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
      className="flex-row items-center justify-between rounded-[14px] bg-label-1 px-4 py-3"
    >
      <Text className="text-body flex-1 text-white" numberOfLines={1}>
        {displayMessage}
      </Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={8} className="ml-3">
          <Text className="text-body-emph text-tint-soft">{actionLabel}</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}
