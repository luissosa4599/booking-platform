import { useEffect, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { cn } from "@/lib/cn";
import { haptics } from "@/lib/haptics";

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
const LABEL_CLASS: Record<Exclude<ButtonVariant, "pill">, string> = {
  filled: "text-white",
  dark: "text-white",
  gray: "text-label-2",
  plain: "text-tint",
};

const SPINNER_BORDER_CLASS: Record<Exclude<ButtonVariant, "pill">, string> = {
  filled: "border-white",
  dark: "border-white",
  gray: "border-label-2",
  plain: "border-tint",
};

const PILL_CONTAINER_CLASS: Record<ButtonPillTone, string> = {
  filled: "bg-tint",
  wash: "bg-tint-wash",
};

const PILL_LABEL_CLASS: Record<ButtonPillTone, string> = {
  filled: "text-white",
  wash: "text-tint",
};

const PILL_SPINNER_BORDER_CLASS: Record<ButtonPillTone, string> = {
  filled: "border-white",
  wash: "border-tint",
};

function Spinner({ borderClassName }: { borderClassName: string }) {
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
}: ButtonProps) {
  "use no memo"; // React Compiler doesn't know Reanimated shared values are safe to mutate.

  const pressProgress = useSharedValue(0);
  const loadingProgress = useSharedValue(loading ? 1 : 0);

  useEffect(() => {
    loadingProgress.value = withTiming(loading ? 1 : 0, { duration: 120 });
  }, [loading, loadingProgress]);

  const pressStyle = useAnimatedStyle(() => ({
    opacity: 1 - pressProgress.value * 0.25,
    transform: [{ scale: 1 - pressProgress.value * 0.02 }],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: 1 - loadingProgress.value,
  }));

  const spinnerStyle = useAnimatedStyle(() => ({
    opacity: loadingProgress.value,
  }));

  const interactive = !disabled && !loading && !!onPress;
  const isPill = variant === "pill";

  const handlePressIn = () => {
    pressProgress.value = withTiming(1, { duration: 90 });
    haptics.selection();
  };

  const handlePressOut = () => {
    pressProgress.value = withSpring(0);
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
              {children}
            </Text>
            {subtitle ? (
              <Text
                className={cn(
                  "text-[12px]",
                  disabled
                    ? "text-disabled-label"
                    : variant === "filled"
                      ? "text-[#F6D9C7]"
                      : labelClass,
                )}
              >
                {subtitle}
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
