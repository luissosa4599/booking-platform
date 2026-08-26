import { Pressable, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  ZoomIn,
} from "react-native-reanimated";

import { Button, Spinner, type ButtonPillTone } from "@/components/Button";
import { cn } from "@/lib/cn";
import { Check, ChevronRight } from "@/lib/icons";

export type RowTrailing = "text" | "chevron" | "action" | "check" | "none";
export type MetaTone = "default" | "waiting" | "last";

interface RowProps {
  title: string;
  /** Time ranges/numbers in the title should align — e.g. ResourceScreen's slot list. */
  tabularTitle?: boolean;
  subtitle?: string;
  meta?: string;
  metaTone?: MetaTone;
  trailing?: RowTrailing;
  trailingText?: string;
  /** Tone for trailing="text" — e.g. "Anotarme" (waiting) or "Último lugar" (last). */
  trailingTone?: MetaTone;
  /** trailing="text" only — swaps trailingText for a small spinner (e.g. joining a waitlist). */
  trailingLoading?: boolean;
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
  tabularTitle = false,
  subtitle,
  meta,
  metaTone = "default",
  trailing = "none",
  trailingText,
  trailingTone = "default",
  trailingLoading = false,
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
          style={tabularTitle ? { fontVariant: ["tabular-nums"] } : undefined}
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
        trailingTone={trailingTone}
        trailingLoading={trailingLoading}
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
  trailingTone = "default",
  trailingLoading = false,
  actionLabel,
  actionTone,
  actionLoading,
  onActionPress,
}: {
  trailing: RowTrailing;
  trailingText?: string;
  trailingTone?: MetaTone;
  trailingLoading?: boolean;
  actionLabel?: string;
  actionTone: ButtonPillTone;
  actionLoading?: boolean;
  onActionPress?: () => void;
}) {
  switch (trailing) {
    case "text":
      if (trailingLoading) {
        return <Spinner borderClassName="border-state-waiting" />;
      }
      return (
        <Text
          className={cn("text-body", META_TONE_CLASS[trailingTone])}
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {trailingText}
        </Text>
      );
    case "chevron":
      // className goes on the wrapping View, not the icon — see lib/icons.ts.
      return (
        <View className="text-chevron">
          <ChevronRight size={19} />
        </View>
      );
    case "check":
      // entering: crossfade + scale-in, ~240ms, per the handoff's "apartar
      // en un tap" success animation. Split in two: the outer
      // Animated.View is what ZoomIn actually animates (layout/transform
      // only), the inner plain View carries the color className —
      // Reanimated's Animated.View doesn't reliably apply a `text-*`
      // (color) class, even though it applies `bg-*` ones fine (see
      // SuccessCheckmark's halo). Confirmed via getComputedStyle: the same
      // className stayed black on Animated.View, resolved correctly on View.
      return (
        <Animated.View entering={ZoomIn.duration(240)}>
          <View className="text-tint">
            <Check size={17} strokeWidth={3} />
          </View>
        </Animated.View>
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
