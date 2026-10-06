import type { ReactNode } from "react";
import { Animated, Pressable, Text, View } from "react-native";

import { useColor } from "@/lib/theme/useColor";
import { useEnterAnimation } from "@/lib/useEnterAnimation";
import { AuthSpinner } from "./AuthSpinner";
import { authType, CONTROL_HEIGHT, CONTROL_RADIUS } from "./authType";

interface Props {
  /** primary = the step's main action (tint); secondary = Google / Correo. */
  variant: "primary" | "secondary";
  label: string;
  /** Shown next to the spinner while `loading` ("Entrando…"). */
  loadingLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  /** Left of the label (20px). Swapped for the spinner while loading. */
  icon?: ReactNode;
  onPress: () => void;
  accessibilityLabel?: string;
}

/**
 * The sign-in redesign's two buttons (handoff §5). Not the app's `Button`:
 * that one swaps its label *for* a spinner, while these keep a label beside
 * the spinner ("Entrando…"), carry an icon, and a loading primary keeps its
 * tint instead of reading as disabled (D1).
 *
 * Colours via `useColor` + inline style — `bg-tint`-style classNames don't
 * resolve inside a Sheet/portal on web, and these may end up in one.
 */
export function AuthButton({
  variant,
  label,
  loadingLabel,
  loading = false,
  disabled = false,
  icon,
  onPress,
  accessibilityLabel,
}: Props) {
  const tint = useColor("tint");
  const tintPress = useColor("tint-press");
  const onTint = useColor("on-tint");
  const card = useColor("card");
  const fill = useColor("fill");
  const hairline = useColor("hairline");
  const label1 = useColor("label-1");
  const disabledLabel = useColor("disabled-label");
  // Handoff §8 "Botón → cargando": the label fades and the spinner comes in
  // at scale 0.8 → 1, 200 ms.
  const contentStyle = useEnterAnimation(loading, { duration: 200, scale: 0.8, onMount: false });

  // A loading button keeps its look (D1/D2) — only an actually-disabled one
  // greys out.
  const inactive = disabled && !loading;
  const fg = inactive ? disabledLabel : variant === "primary" ? onTint : label1;
  const text = loading && loadingLabel ? loadingLabel : label;

  return (
    <Pressable
      onPress={loading || disabled ? undefined : onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={loading ? (loadingLabel ?? label).replace("…", "") : (accessibilityLabel ?? label)}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={({ pressed }) => {
        const bg = inactive
          ? fill
          : variant === "primary"
            ? pressed && !loading
              ? tintPress
              : tint
            : pressed && !loading
              ? fill
              : card;
        return {
          height: CONTROL_HEIGHT,
          borderRadius: CONTROL_RADIUS,
          backgroundColor: bg,
          borderWidth: variant === "secondary" ? 1 : 0,
          borderColor: hairline,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 16,
        };
      }}
    >
      <Animated.View
        style={[{ flexDirection: "row", alignItems: "center", gap: 12 }, contentStyle]}
      >
        {loading ? (
          <AuthSpinner color={fg} />
        ) : icon ? (
          <View importantForAccessibility="no-hide-descendants">{icon}</View>
        ) : null}
        <Text style={[variant === "primary" ? authType.button : authType.button2, { color: fg }]}>
          {text}
        </Text>
      </Animated.View>
    </Pressable>
  );
}
