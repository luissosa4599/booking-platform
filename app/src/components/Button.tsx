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

import { cn } from "@/lib/cn";
import { haptics } from "@/lib/haptics";
import { useReduceMotion } from "@/lib/useReduceMotion";

export type ButtonVariant = "filled" | "dark" | "gray" | "plain" | "pill";
export type ButtonPillTone = "filled" | "wash";

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
  /** Falls back to `children` when it's a plain string — pass this when the
   * label alone isn't descriptive enough (e.g. a "Cancelar" pill should
   * announce which booking it cancels). */
  accessibilityLabel?: string;
}

// Shape (height/radius/padding) is separate from background so `disabled`
// can swap just the color and keep the button's size/shape intact.
const CONTAINER_SHAPE_CLASS: Record<Exclude<ButtonVariant, "pill">, string> = {
  filled: "h-[52px] rounded-button px-4",
  dark: "h-[52px] rounded-button px-4",
  gray: "h-[52px] rounded-button px-4",
  plain: "h-[48px] px-4",
};

const CONTAINER_BG_CLASS: Record<Exclude<ButtonVariant, "pill">, string> = {
  filled: "bg-tint",
  dark: "bg-label-1",
  gray: "bg-fill",
  plain: "",
};

// Label color also doubles as the spinner's ring color while loading — both
// need to react to a theme change the same way, so they share this map
// instead of the spinner hardcoding a hex value.
// `filled` sits on `tint`, so its label follows `on-tint` (white in light,
// #40200B in dark — see ThemeProvider). `dark` sits on `label-1`, which is
// near-black in light and *white* in dark, so its label follows `canvas`
// (the inverse) rather than a fixed white that would vanish in dark mode.
const LABEL_CLASS: Record<Exclude<ButtonVariant, "pill">, string> = {
  filled: "text-on-tint",
  dark: "text-canvas",
  gray: "text-label-2",
  plain: "text-tint",
};

const SPINNER_BORDER_CLASS: Record<Exclude<ButtonVariant, "pill">, string> = {
  filled: "border-on-tint",
  dark: "border-canvas",
  gray: "border-label-2",
  plain: "border-tint",
};

const PILL_CONTAINER_CLASS: Record<ButtonPillTone, string> = {
  filled: "bg-tint",
  wash: "bg-tint-wash",
};

// "wash" is 3.99:1 with plain `text-tint` on `bg-tint-wash` — under the 4.5:1
// AA floor for 15px text. `text-tint-press` is the same combination Row's
// selected state and the day pills already use for AA (5.55:1) on this exact
// background.
const PILL_LABEL_CLASS: Record<ButtonPillTone, string> = {
  filled: "text-on-tint",
  wash: "text-tint-press",
};

const PILL_SPINNER_BORDER_CLASS: Record<ButtonPillTone, string> = {
  filled: "border-on-tint",
  wash: "border-tint-press",
};

export function Spinner({ borderClassName }: { borderClassName: string }) {
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
      style={style}
      className={cn(
        "h-[18px] w-[18px] rounded-full border-2 border-t-transparent",
        borderClassName,
      )}
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
  className,
  accessibilityLabel,
}: ButtonProps) {
  "use no memo"; // React Compiler doesn't know Reanimated shared values are safe to mutate.

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
      withTiming(0, { duration: 60 }),
      withTiming(1, { duration: 60 }),
    );
    const timeout = setTimeout(() => {
      setDisplayChildren(children);
      setDisplaySubtitle(subtitle);
    }, 60);
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
  const bgClass = disabled
    ? "bg-fill"
    : isPill
      ? PILL_CONTAINER_CLASS[tone]
      : CONTAINER_BG_CLASS[variant];

  const labelClass = isPill ? PILL_LABEL_CLASS[tone] : LABEL_CLASS[variant];
  const spinnerBorderClass = isPill
    ? PILL_SPINNER_BORDER_CLASS[tone]
    : SPINNER_BORDER_CLASS[variant];
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
        className={cn(
          "flex-row items-center justify-center",
          shapeClass,
          bgClass,
          className,
        )}
      >
        <View className="relative flex-row items-center justify-center">
          <Animated.View
            style={labelStyle}
            className="flex-col items-center justify-center gap-px"
          >
            <Text
              className={cn(
                labelSizeClass,
                disabled ? "text-disabled-label" : labelClass,
              )}
            >
              {displayChildren}
            </Text>
            {displaySubtitle ? (
              <Text
                className={cn(
                  "text-[12px]",
                  disabled
                    ? "text-disabled-label"
                    : variant === "filled"
                      ? "text-on-tint opacity-80"
                      : labelClass,
                )}
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
              <Spinner borderClassName={spinnerBorderClass} />
            </Animated.View>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}
