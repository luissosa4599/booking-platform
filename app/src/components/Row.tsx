import { Pressable, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  ZoomIn,
} from "react-native-reanimated";

import { Button, type ButtonPillTone } from "@/components/Button";
import { cn } from "@/lib/cn";

export type RowTrailing = "text" | "chevron" | "action" | "check" | "none";
type MetaTone = "default" | "waiting" | "last";

interface RowProps {
  title: string;
  subtitle?: string;
  meta?: string;
  metaTone?: MetaTone;
  trailing?: RowTrailing;
  trailingText?: string;
  actionLabel?: string;
  actionTone?: ButtonPillTone;
  actionLoading?: boolean;
  onActionPress?: () => void;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}

const META_TONE_CLASS: Record<MetaTone, string> = {
  default: "text-label-3",
  waiting: "text-state-waiting",
  last: "text-state-last",
};

export function Row({
  title,
  subtitle,
  meta,
  metaTone = "default",
  trailing = "none",
  trailingText,
  actionLabel,
  actionTone = "filled",
  actionLoading = false,
  onActionPress,
  selected = false,
  disabled = false,
  onPress,
}: RowProps) {
  "use no memo"; // React Compiler doesn't know Reanimated shared values are safe to mutate.

  const pressProgress = useSharedValue(0);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, pressProgress.value),
  }));

  const pressable = !!onPress && !disabled;

  const handlePressIn = () => {
    pressProgress.value = withTiming(1, { duration: 80 });
  };

  const handlePressOut = () => {
    pressProgress.value = withTiming(0, { duration: 80 });
  };

  const effectiveTrailing = selected ? "check" : trailing;

  const content = (
    <View
      className={cn(
        "relative min-h-[56px] flex-row items-center gap-3 px-4 py-3",
        selected ? "bg-tint-wash" : undefined,
        disabled ? "opacity-45" : undefined,
      )}
    >
      {pressable ? (
        <Animated.View
          style={[overlayStyle, { pointerEvents: "none" }]}
          className="absolute inset-0 bg-fill"
        />
      ) : null}

      <View className="flex-1 flex-col gap-[3px]">
        <Text
          numberOfLines={1}
          className={cn(
            "text-body-emph",
            disabled ? "text-label-4" : selected ? "text-tint-press" : "text-label-1",
          )}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} className="text-subhead text-label-3">
            {subtitle}
          </Text>
        ) : null}
        {meta ? (
          <Text
            numberOfLines={1}
            className={cn("text-subhead", META_TONE_CLASS[metaTone])}
          >
            {meta}
          </Text>
        ) : null}
      </View>

      <RowTrailingContent
        trailing={effectiveTrailing}
        trailingText={trailingText}
        actionLabel={actionLabel}
        actionTone={actionTone}
        actionLoading={actionLoading}
        onActionPress={onActionPress}
      />
    </View>
  );

  return pressable ? (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      {content}
    </Pressable>
  ) : (
    content
  );
}

function RowTrailingContent({
  trailing,
  trailingText,
  actionLabel,
  actionTone,
  actionLoading,
  onActionPress,
}: {
  trailing: RowTrailing;
  trailingText?: string;
  actionLabel?: string;
  actionTone: ButtonPillTone;
  actionLoading?: boolean;
  onActionPress?: () => void;
}) {
  switch (trailing) {
    case "text":
      return (
        <Text
          className="text-body text-label-3"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {trailingText}
        </Text>
      );
    case "chevron":
      return <Text className="text-[19px] text-chevron">›</Text>;
    case "check":
      // entering: crossfade + scale-in, ~240ms, per the handoff's "apartar
      // en un tap" success animation.
      return (
        <Animated.Text
          entering={ZoomIn.duration(240)}
          className="text-[17px] font-semibold text-tint"
        >
          ✓
        </Animated.Text>
      );
    case "action":
      return (
        <Button
          variant="pill"
          tone={actionTone}
          loading={actionLoading}
          onPress={onActionPress}
        >
          {actionLabel}
        </Button>
      );
    case "none":
    default:
      return null;
  }
}
