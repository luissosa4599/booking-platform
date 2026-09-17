import { useEffect, useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useColorScheme } from "nativewind";

import { cn } from "@/lib/cn";
import { haptics } from "@/lib/haptics";
import { palette, type ColorToken } from "@/lib/theme/palette";
import { useReduceMotion } from "@/lib/useReduceMotion";

// "gray-destructive" — same shape/bg as "gray" (fill, per the confirmation
// Sheet's neutral surface), label recolored to state-error. Reservas/Tú
// handoff: the confirm button inside CancelBookingSheet and the sign-out
// confirm Sheet both need this — "gray" alone resolves to label-2, it can't
// carry the destructive-red text on its own.
export type ButtonVariant = "filled" | "dark" | "gray" | "gray-destructive" | "plain" | "pill";
export type ButtonPillTone = "filled" | "wash" | "on-tint";

interface ButtonProps {
  variant?: ButtonVariant;
  /** Only used when variant === "pill". */
  tone?: ButtonPillTone;
  subtitle?: string;
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  children: ReactNode;
  className?: string;
  /** Resource-detail §4 point 4 — the "Apartar 01:01 p.m. – 02:31 p.m." CTA
   * needs tabular-nums on its time range so digits don't jitter in width. */
  tabularLabel?: boolean;
  /** Falls back to `children` when it's a plain string — pass this when the
   * label alone isn't descriptive enough (e.g. a "Cancelar" pill should
   * announce which booking it cancels). */
  accessibilityLabel?: string;
}

// Shape (height/radius/padding) is separate from color — plain structural
// classes, safe as NativeWind classNames (no theme-variable dependency, see
// the color tables below for why those can't be).
const CONTAINER_SHAPE_CLASS: Record<Exclude<ButtonVariant, "pill">, string> = {
  filled: "h-[52px] rounded-button px-4",
  dark: "h-[52px] rounded-button px-4",
  gray: "h-[52px] rounded-button px-4",
  "gray-destructive": "h-[52px] rounded-button px-4",
  plain: "h-[48px] px-4",
};

// Resolved via `palette()` + inline `style`, NOT NativeWind classNames like
// `bg-tint`/`text-tint` — those are the 6 "themeable" tokens, injected as CSS
// custom properties on a `ThemeProvider` wrapper `vars()` on web. `Button` is
// used inside `Sheet`/other RN `Modal` content, and react-native-web's
// `Modal` renders its children through a DOM portal — a *React* child but
// not a *DOM* descendant of that wrapper, so the CSS custom properties never
// reach it. Confirmed via getComputedStyle: `bg-tint` resolved to a fully
// transparent background on a Button rendered inside a Sheet (2026-09-14
// report) — the same class of bug already existed, unnoticed, in
// HostUpgradedSheet/ScanResultSheet/SlotSheet. Resolving through `palette()`
// (a plain JS lookup, not a CSS variable) sidesteps the portal entirely and
// works everywhere, sheet or not.
const CONTAINER_BG_TOKEN: Record<Exclude<ButtonVariant, "pill">, ColorToken | null> = {
  filled: "tint",
  dark: "label-1",
  gray: "fill",
  "gray-destructive": "fill",
  plain: null,
};

// Label color also doubles as the spinner's ring color while loading — both
// need to react to a theme change the same way, so they share this map
// instead of the spinner hardcoding a hex value.
// `filled` sits on `tint`, so its label follows `on-tint` (white in light,
// #40200B in dark — see ThemeProvider). `dark` sits on `label-1`, which is
// near-black in light and *white* in dark, so its label follows `canvas`
// (the inverse) rather than a fixed white that would vanish in dark mode.
const LABEL_TOKEN: Record<Exclude<ButtonVariant, "pill">, ColorToken> = {
  filled: "on-tint",
  dark: "canvas",
  gray: "label-2",
  "gray-destructive": "state-error",
  plain: "tint",
};

const PILL_CONTAINER_TOKEN: Record<ButtonPillTone, ColorToken> = {
  filled: "tint",
  wash: "tint-wash",
  // NextBookingBanner's "Ver pase" — the pill sits on the tint-filled banner
  // itself, so it needs to read as a surface, not another patch of tint.
  "on-tint": "card",
};

// "wash" is 3.99:1 with plain `tint` on `tint-wash` — under the 4.5:1 AA
// floor for 15px text. `tint-press` is the same combination Row's selected
// state and the day pills already use for AA (5.55:1) on this exact
// background.
const PILL_LABEL_TOKEN: Record<ButtonPillTone, ColorToken> = {
  filled: "on-tint",
  wash: "tint-press",
  "on-tint": "tint",
};

export function Spinner({ borderColor }: { borderColor: string }) {
  "use no memo"; // React Compiler doesn't know Reanimated shared values are safe to mutate.

  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 700, easing: Easing.linear }),
      -1,
    );
  }, [rotation]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View
      style={[
        style,
        { borderColor, borderTopColor: "transparent" },
      ]}
      className="h-[18px] w-[18px] rounded-full border-2"
    />
  );
}

export function Button({
  variant = "filled",
  tone = "filled",
  subtitle,
  loading = false,
  disabled = false,
  onPress,
  children,
  tabularLabel = false,
  className,
  accessibilityLabel,
}: ButtonProps) {
  "use no memo"; // React Compiler doesn't know Reanimated shared values are safe to mutate.

  const { colorScheme } = useColorScheme();
  const colors = palette(colorScheme === "dark" ? "dark" : "light");

  const reduceMotion = useReduceMotion();
  const pressProgress = useSharedValue(0);
  const loadingProgress = useSharedValue(loading ? 1 : 0);

  useEffect(() => {
    loadingProgress.value = withTiming(loading ? 1 : 0, {
      duration: reduceMotion ? 0 : 120,
    });
  }, [loading, loadingProgress, reduceMotion]);

  // Handoff: "El CTA nunca desaparece ni cambia de tamaño al cambiar la
  // selección: solo su label hace crossfade de 120ms" — e.g. ResourceScreen's
  // "Elige un horario" → "Apartar 14:00" as the user picks a slot. Held in
  // local state so the outgoing label stays on screen through the first half
  // of the fade instead of being replaced instantly by the incoming one.
  // Total bumped 120ms -> 200ms for perceptibility (2026-09-11 punch-list
  // item 4) — a deliberate deviation from the audited handoff number, not a
  // bug. 200ms sits at the low end of the standard "state change" band
  // (general UX guidance: 200-300ms) — deliberately the low end since this
  // is just a label swap, the CTA itself never moves or resizes.
  const [displayChildren, setDisplayChildren] = useState(children);
  const [displaySubtitle, setDisplaySubtitle] = useState(subtitle);
  const labelCrossfade = useSharedValue(1);

  // Reduce motion: sync instantly, computed during render rather than in an
  // effect — same "derive next state from a changed prop" pattern
  // ConflictSheet already uses for its own retained-value state.
  if (reduceMotion && (children !== displayChildren || subtitle !== displaySubtitle)) {
    setDisplayChildren(children);
    setDisplaySubtitle(subtitle);
  }

  useEffect(() => {
    if (reduceMotion) {
      return;
    }
    if (children === displayChildren && subtitle === displaySubtitle) {
      return;
    }
    labelCrossfade.value = withSequence(
      withTiming(0, { duration: 100 }),
      withTiming(1, { duration: 100 }),
    );
    const timeout = setTimeout(() => {
      setDisplayChildren(children);
      setDisplaySubtitle(subtitle);
    }, 100);
    return () => clearTimeout(timeout);
  }, [children, subtitle, displayChildren, displaySubtitle, labelCrossfade, reduceMotion]);

  const pressStyle = useAnimatedStyle(() => ({
    opacity: 1 - pressProgress.value * 0.25,
    transform: [{ scale: 1 - pressProgress.value * 0.02 }],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: (1 - loadingProgress.value) * labelCrossfade.value,
  }));

  const spinnerStyle = useAnimatedStyle(() => ({
    opacity: loadingProgress.value,
  }));

  const interactive = !disabled && !loading && !!onPress;
  const isPill = variant === "pill";

  const handlePressIn = () => {
    pressProgress.value = reduceMotion
      ? 1
      : withTiming(1, { duration: 90 });
    haptics.selection();
  };

  const handlePressOut = () => {
    pressProgress.value = reduceMotion ? 0 : withSpring(0);
  };

  const shapeClass = isPill ? "h-[38px] rounded-full px-4" : CONTAINER_SHAPE_CLASS[variant];
  const bgToken = isPill ? PILL_CONTAINER_TOKEN[tone] : CONTAINER_BG_TOKEN[variant];
  const bgColor = disabled ? colors.fill : bgToken ? colors[bgToken] : "transparent";

  const labelToken = isPill ? PILL_LABEL_TOKEN[tone] : LABEL_TOKEN[variant];
  const labelColor = disabled ? colors["disabled-label"] : colors[labelToken];
  const labelSizeClass = isPill ? "text-[15px] font-semibold" : "text-body-emph";

  return (
    <Animated.View style={interactive ? pressStyle : undefined}>
      <Pressable
        onPress={interactive ? onPress : undefined}
        onPressIn={interactive ? handlePressIn : undefined}
        onPressOut={interactive ? handlePressOut : undefined}
        disabled={!interactive}
        accessibilityRole="button"
        accessibilityLabel={
          accessibilityLabel ??
          (typeof children === "string"
            ? [children, subtitle].filter(Boolean).join(", ")
            : undefined)
        }
        accessibilityState={{ disabled: !interactive, busy: loading }}
        // Pill is 38pt tall — under the 44×44pt minimum touch target.
        hitSlop={isPill ? { top: 6, bottom: 6 } : undefined}
        style={{ backgroundColor: bgColor }}
        className={cn("flex-row items-center justify-center", shapeClass, className)}
      >
        <View className="relative flex-row items-center justify-center">
          <Animated.View
            style={labelStyle}
            className="flex-col items-center justify-center gap-px"
          >
            <Text
              className={labelSizeClass}
              style={{
                color: labelColor,
                fontVariant: tabularLabel ? ["tabular-nums"] : undefined,
              }}
            >
              {displayChildren}
            </Text>
            {displaySubtitle ? (
              <Text
                className="text-[12px]"
                style={{
                  color: labelColor,
                  opacity: disabled ? 1 : variant === "filled" ? 0.8 : 1,
                }}
              >
                {displaySubtitle}
              </Text>
            ) : null}
          </Animated.View>

          {loading ? (
            <Animated.View
              style={[spinnerStyle, { pointerEvents: "none" }]}
              className="absolute inset-0 items-center justify-center"
            >
              <Spinner borderColor={labelColor} />
            </Animated.View>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}
