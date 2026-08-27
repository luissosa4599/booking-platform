import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Button, Spinner, type ButtonPillTone } from "@/components/Button";
import { cn } from "@/lib/cn";
import { Check, ChevronRight } from "@/lib/icons";
import { useReduceMotion } from "@/lib/useReduceMotion";

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
  /** Falls back to a label built from title/subtitle/meta/trailingText when
   * not given — pass this whenever that fallback wouldn't read naturally. */
  accessibilityLabel?: string;
  /** Label for the trailing="action" pill (e.g. "Cancelar reserva de Sala
   * Boreal 204, hoy 3:00 PM") — the pill's own text ("Cancelar") alone isn't
   * descriptive enough on its own. */
  actionAccessibilityLabel?: string;
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
  accessibilityLabel,
  actionAccessibilityLabel,
}: RowProps) {
  "use no memo"; // React Compiler doesn't know Reanimated shared values are safe to mutate.

  const reduceMotion = useReduceMotion();
  const pressProgress = useSharedValue(0);
  // Handoff "Interactions & Behavior" table: "Selección de slot — 150ms
  // ease-out, fondo... interpolado". A literal backgroundColor interpolation
  // isn't viable here — NativeWind's `bg-tint-wash` resolves through a CSS
  // custom property, which Reanimated's Animated.View can't read a literal
  // color out of (same class of gotcha as everywhere else in this app, see
  // CLAUDE.md). Fading in a `bg-tint-wash` overlay's opacity gets the same
  // visual result without needing a literal color value.
  const selectedProgress = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    selectedProgress.value = reduceMotion
      ? (selected ? 1 : 0)
      : withTiming(selected ? 1 : 0, {
          duration: 150,
          easing: Easing.out(Easing.ease),
        });
  }, [selected, selectedProgress, reduceMotion]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, pressProgress.value),
  }));

  const selectedOverlayStyle = useAnimatedStyle(() => ({
    opacity: selectedProgress.value,
  }));

  const pressable = !!onPress && !disabled;

  const handlePressIn = () => {
    pressProgress.value = reduceMotion
      ? 1
      : withTiming(1, { duration: 80, easing: Easing.linear });
  };

  const handlePressOut = () => {
    pressProgress.value = reduceMotion
      ? 0
      : withTiming(0, { duration: 80, easing: Easing.linear });
  };

  const effectiveTrailing = selected ? "check" : trailing;

  const fallbackLabel = [title, subtitle, meta, trailingText]
    .filter((part): part is string => !!part)
    .join(", ");

  const content = (
    <View
      className={cn(
        "relative min-h-[56px] flex-row items-center gap-3 px-4 py-3",
        disabled ? "opacity-45" : undefined,
      )}
    >
      <Animated.View
        style={[selectedOverlayStyle, { pointerEvents: "none", zIndex: -1 }]}
        className="absolute inset-0 bg-tint-wash"
      />

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
        actionAccessibilityLabel={actionAccessibilityLabel}
        onActionPress={onActionPress}
      />
    </View>
  );

  return pressable ? (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      // react-native-web renders accessibilityRole="button" as a literal
      // <button>. Rows with a nested "action" pill already render their own
      // <button> (via Button) — explicitly roling the outer row too would
      // nest a <button> inside a <button>, which is invalid HTML and threw a
      // hydration error (confirmed via Playwright). Leaving the role unset
      // here still leaves the row focusable/tappable, just without the
      // (invalid, in this one case) explicit button semantics.
      accessibilityRole={onActionPress ? undefined : "button"}
      accessibilityLabel={accessibilityLabel ?? fallbackLabel}
      accessibilityState={{ disabled, selected }}
    >
      {content}
    </Pressable>
  ) : (
    content
  );
}

// Handoff table: "Apartar → ✓ — 240ms, crossfade + scale 0.9→1, en el mismo
// lugar de la pastilla." Hand-rolled instead of the built-in `ZoomIn` preset
// (which scales in from 0, not 0.9) — split the same way as everywhere else
// in this app: the outer Animated.View owns the transform/opacity, the inner
// plain View carries the `text-tint` color class (Animated.View doesn't
// reliably apply `text-*` color classes, only `bg-*` ones).
function CheckIcon() {
  "use no memo"; // React Compiler doesn't know Reanimated shared values are safe to mutate.

  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = reduceMotion ? 1 : withTiming(1, { duration: 240 });
  }, [progress, reduceMotion]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.9 + progress.value * 0.1 }],
  }));

  return (
    <Animated.View style={style}>
      <View className="text-tint">
        <Check size={17} strokeWidth={3} />
      </View>
    </Animated.View>
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
  actionAccessibilityLabel,
  onActionPress,
}: {
  trailing: RowTrailing;
  trailingText?: string;
  trailingTone?: MetaTone;
  trailingLoading?: boolean;
  actionLabel?: string;
  actionTone: ButtonPillTone;
  actionLoading?: boolean;
  actionAccessibilityLabel?: string;
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
      return <CheckIcon />;
    case "action":
      return (
        <Button
          variant="pill"
          tone={actionTone}
          loading={actionLoading}
          onPress={onActionPress}
          accessibilityLabel={actionAccessibilityLabel ?? actionLabel}
        >
          {actionLabel}
        </Button>
      );
    case "none":
    default:
      return null;
  }
}
