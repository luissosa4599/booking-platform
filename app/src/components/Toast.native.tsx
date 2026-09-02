import { useEffect, useRef } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";

import type { ToastProps } from "./Toast.types";

// Both callers (Explore, Reservas) are tabbed screens, so the toast has to
// clear the TabBar (h-82 + insets.bottom, see (tabs)/_layout.tsx) — at the
// old `bottom-6` it rendered *behind* the bar and was invisible on device.
const TAB_BAR_HEIGHT = 82;

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
  const insets = useSafeAreaInsets();
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
      style={{ bottom: insets.bottom + TAB_BAR_HEIGHT + 12 }}
      // On the app's warm accent instead of a dark pill — a booking
      // confirmation should read as a positive beat, and the dark toast blended
      // into the screen on device. `on-tint` is the paired readable-on-tint
      // colour (white in light, dark-brown in dark).
      className="absolute inset-x-4 flex-row items-center justify-between rounded-[14px] bg-tint px-4 py-3"
    >
      <Text className="text-body flex-1 text-on-tint" numberOfLines={1}>
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
          <View className="border-b border-on-tint">
            <Text className="text-body-emph text-on-tint">{actionLabel}</Text>
          </View>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}
