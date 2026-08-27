import { useEffect, useRef } from "react";
import { Pressable, Text } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";

import type { ToastProps } from "./Toast.types";

// See Toast.web.tsx for why web doesn't use Reanimated here — that bug
// (Animated.View misrendering as a descendant of an edge-anchored
// `position: absolute` container) never reproduced on native, so this stays
// on the straightforward `entering`/`exiting` approach: returning `null`
// unmounts the Animated.View, and Reanimated defers the actual removal
// until `exiting` finishes.
export function Toast({
  isOpen,
  message,
  actionLabel,
  onAction,
  onDismiss,
  durationMs = 4000,
}: ToastProps) {
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

  if (!isOpen) {
    return null;
  }

  return (
    <Animated.View
      entering={FadeInDown}
      exiting={FadeOutDown}
      // Fixed dark surface, not the theme-reactive `bg-label-1` token —
      // `label-1` flips to white in dark mode, which would have put white
      // text on a white toast. A toast is conventionally an always-dark
      // pill regardless of the app's own light/dark mode.
      className="absolute inset-x-4 bottom-6 flex-row items-center justify-between rounded-[14px] bg-[#1C1C1E] px-4 py-3"
    >
      <Text className="text-body flex-1 text-white" numberOfLines={1}>
        {message}
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
    </Animated.View>
  );
}
