import { useEffect, useRef } from "react";
import { Pressable, Text, View } from "react-native";

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
//
// No entrance/exit animation: with `experiments.reactCompiler: false` (see
// docs/session-log.md), a Reanimated `entering`/`exiting` version no longer
// crashes on web, but it introduced a separate, still-unresolved rendering
// glitch — the card doesn't paint reliably even though its computed position
// is correct. Left static until that's chased down; not a silent omission.
export function Toast({
  message,
  actionLabel,
  onAction,
  onDismiss,
  durationMs = 4000,
}: ToastProps) {
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
    const timeout = setTimeout(() => onDismissRef.current(), durationMs);
    return () => clearTimeout(timeout);
  }, [message, durationMs]);

  return (
    <View className="absolute inset-x-4 bottom-6 flex-row items-center justify-between rounded-[14px] bg-label-1 px-4 py-3">
      <Text className="text-body flex-1 text-white" numberOfLines={1}>
        {message}
      </Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={8} className="ml-3">
          <Text className="text-body-emph text-tint-soft">{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
