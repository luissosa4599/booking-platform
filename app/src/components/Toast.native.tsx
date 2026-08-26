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
      className="absolute inset-x-4 bottom-6 flex-row items-center justify-between rounded-[14px] bg-label-1 px-4 py-3"
    >
      <Text className="text-body flex-1 text-white" numberOfLines={1}>
        {message}
      </Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={8} className="ml-3">
          <Text className="text-body-emph text-tint-soft">{actionLabel}</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}
