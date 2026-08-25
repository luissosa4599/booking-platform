import { useEffect } from "react";
import { Pressable, Text } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";

interface ToastProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
  durationMs?: number;
}

// Not one of the "componentes faltantes" the task named, but the booking
// interaction spec requires a bottom toast with an action — built minimal
// and non-reusable-beyond-this-shape on purpose, not a full design-system piece.
export function Toast({
  message,
  actionLabel,
  onAction,
  onDismiss,
  durationMs = 4000,
}: ToastProps) {
  useEffect(() => {
    const timeout = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timeout);
  }, [onDismiss, durationMs]);

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
