import type { ReactNode } from "react";
import { Animated, Platform, Pressable, Text, View, type TextStyle } from "react-native";
import { useRouter } from "expo-router";

import { BrandMark } from "@/components/BrandMark";
import { ArrowLeft, AtSign, CircleAlert, Clock, MailCheck, WifiOff, X } from "@/lib/icons";
import { useColor } from "@/lib/theme/useColor";
import { useEnterAnimation } from "@/lib/useEnterAnimation";
import { authType, CONTROL_RADIUS } from "./authType";

// The smaller building blocks of the sign-in redesign (handoff §5). The
// screens themselves live in app/sign-in, forgot-password, reset-password.

/** 56px bar with a 48×48 back/close button, nudged −12 so the icon lines up
 * with the 24px gutter, and an optional title (the keyboard-open state, I). */
export function AuthTopBar({
  kind,
  onPress,
  disabled = false,
  title,
  accessibilityLabel,
}: {
  kind: "back" | "close" | "none";
  onPress?: () => void;
  disabled?: boolean;
  title?: string;
  accessibilityLabel?: string;
}) {
  const label1 = useColor("label-1");
  const disabledLabel = useColor("disabled-label");
  const Icon = kind === "close" ? X : ArrowLeft;
  return (
    <View style={{ height: 56, flexDirection: "row", alignItems: "center" }}>
      {kind !== "none" ? (
        <Pressable
          onPress={disabled ? undefined : onPress}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? (kind === "close" ? "Cerrar" : "Volver")}
          accessibilityState={{ disabled }}
          hitSlop={4}
          style={{ width: 48, height: 48, marginLeft: -12, alignItems: "center", justifyContent: "center" }}
        >
          <Icon size={24} color={disabled ? disabledLabel : label1} />
        </Pressable>
      ) : null}
      {title ? (
        <Text style={[authType.barTitle, { color: label1, marginLeft: 4 }]} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
    </View>
  );
}

/** Tempo's app icon at the handoff's 60/16 size (§5). The handoff drew a
 * placeholder mark for its working name; the real "T" replaces it
 * (2026-10-12), same as welcome/about. On the web panel (tint ground) in
 * light mode the icon's own ground matches the panel, so only the T reads —
 * on purpose. Decorative — the title says it. */
export function BrandLogo() {
  return (
    <View
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: 60, height: 60, borderRadius: 16, overflow: "hidden" }}
    >
      <BrandMark size={60} />
    </View>
  );
}

/** A, B, H: logo → 24 → "Aparta tu lugar." → 8 → subtitle. */
export function BrandHero({ subtitle, showSubtitle = true }: { subtitle: string; showSubtitle?: boolean }) {
  const label1 = useColor("label-1");
  const label2 = useColor("label-2");
  return (
    <View>
      <BrandLogo />
      <Text style={[authType.display, { color: label1, marginTop: 24 }]} accessibilityRole="header">
        Aparta tu lugar.
      </Text>
      {showSubtitle ? (
        <Text style={[authType.body, { color: label2, marginTop: 8 }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

/** F, G, K: (badge 64 → 24) → title → 8 → subtitle. */
export function StepHero({
  title,
  subtitle,
  badge,
}: {
  title: string;
  subtitle?: ReactNode;
  badge?: "mail" | "clock";
}) {
  const label1 = useColor("label-1");
  const label2 = useColor("label-2");
  const tint = useColor("tint");
  const tintWash = useColor("tint-wash");
  const fill = useColor("fill");
  return (
    <View>
      {badge ? (
        <View
          importantForAccessibility="no-hide-descendants"
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            marginBottom: 24,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: badge === "mail" ? tintWash : fill,
          }}
        >
          {badge === "mail" ? <MailCheck size={28} color={tint} /> : <Clock size={28} color={label2} />}
        </View>
      ) : null}
      <Text style={[authType.title, { color: label1 }]} accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? (
        <Text style={[authType.body, { color: label2, marginTop: 8 }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

/** Handoff §5 banner — above the fields; offline (label-1 icon, polite) or a
 * server/network error (state-error icon, assertive). Slides down 8px in. */
export function AuthBanner({ kind, text }: { kind: "offline" | "error"; text: string }) {
  const fill = useColor("fill");
  const label1 = useColor("label-1");
  const stateError = useColor("state-error");
  const enter = useEnterAnimation(`${kind}:${text}`, { duration: 240, translateY: -8 });
  return (
    <Animated.View
      accessibilityLiveRegion={kind === "offline" ? "polite" : "assertive"}
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          borderRadius: CONTROL_RADIUS,
          backgroundColor: fill,
          paddingVertical: 14,
          paddingHorizontal: 16,
        },
        enter,
      ]}
    >
      <View importantForAccessibility="no-hide-descendants">
        {kind === "offline" ? (
          <WifiOff size={20} color={label1} />
        ) : (
          <CircleAlert size={20} color={stateError} />
        )}
      </View>
      <Text style={[authType.inline, { color: label1, flex: 1 }]}>{text}</Text>
    </Animated.View>
  );
}

/** F, G: the email exactly as typed, with "Corregir"/"Cambiar". */
export function EmailCard({
  email,
  actionLabel,
  onAction,
  actionAccessibilityLabel,
  disabled = false,
}: {
  email: string;
  actionLabel: string;
  onAction: () => void;
  actionAccessibilityLabel: string;
  disabled?: boolean;
}) {
  const fill = useColor("fill");
  const label1 = useColor("label-1");
  const label3 = useColor("label-3");
  const tint = useColor("tint");
  const disabledLabel = useColor("disabled-label");
  return (
    <View
      style={{
        minHeight: 56,
        borderRadius: CONTROL_RADIUS,
        backgroundColor: fill,
        flexDirection: "row",
        alignItems: "center",
        paddingTop: 4,
        paddingBottom: 4,
        paddingRight: 4,
        paddingLeft: 16,
        gap: 12,
      }}
    >
      <View importantForAccessibility="no-hide-descendants">
        <AtSign size={20} color={label3} />
      </View>
      <Text
        style={[
          authType.emailCard,
          // minWidth 0 + break-all (web): an email is one long "word", and
          // without these it refused to shrink and pushed the action off
          // the card (measured). Handoff: "corta en cualquier carácter".
          { color: label1, flex: 1, minWidth: 0 },
          Platform.OS === "web" ? ({ wordBreak: "break-all" } as unknown as TextStyle) : null,
        ]}
        accessibilityLabel={`Correo: ${email}`}
      >
        {email}
      </Text>
      <Pressable
        onPress={disabled ? undefined : onAction}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={actionAccessibilityLabel}
        accessibilityState={{ disabled }}
        style={{ height: 48, paddingHorizontal: 12, justifyContent: "center" }}
      >
        <Text style={[authType.action, { color: disabled ? disabledLabel : tint }]}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

/** A 48-tall text link (handoff §5): tint, or label-1 underlined. */
export function AuthLink({
  label,
  onPress,
  tone = "tint",
  disabled = false,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  tone?: "tint" | "underline";
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const tint = useColor("tint");
  const label1 = useColor("label-1");
  const disabledLabel = useColor("disabled-label");
  const color = disabled ? disabledLabel : tone === "tint" ? tint : label1;
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={{ height: 48, justifyContent: "center", alignSelf: "center" }}
    >
      <Text
        style={[
          authType.button2,
          { color },
          tone === "underline" ? { textDecorationLine: "underline" } : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Caption under the doors / in G: inline, label-3, centred. */
export function AuthCaption({ children }: { children: ReactNode }) {
  const label3 = useColor("label-3");
  return <Text style={[authType.inline, { color: label3, textAlign: "center" }]}>{children}</Text>;
}

/**
 * Pie (A, H): divider → "Explorar sin cuenta" → demo note. The note is a
 * store requirement and stays in every variant; H drops the divider and the
 * guest link (the guest is already browsing).
 */
export function AuthFooter({
  showGuest,
  onGuest,
  guestDisabled = false,
}: {
  showGuest: boolean;
  onGuest?: () => void;
  guestDisabled?: boolean;
}) {
  const router = useRouter();
  const hairline = useColor("hairline");
  const label1 = useColor("label-1");
  const label3 = useColor("label-3");
  return (
    <View style={{ marginTop: 16, alignItems: "center" }}>
      {showGuest && onGuest ? (
        <>
          <View style={{ height: 1, alignSelf: "stretch", backgroundColor: hairline }} />
          <View style={{ height: 8 }} />
          <AuthLink label="Explorar sin cuenta" tone="underline" onPress={onGuest} disabled={guestDisabled} />
          <View style={{ height: 8 }} />
        </>
      ) : null}
      <Pressable
        onPress={() => router.push("/about")}
        accessibilityRole="link"
        accessibilityLabel="Más información sobre esta versión de prueba"
        hitSlop={8}
        style={{ minHeight: 48, maxWidth: 300, justifyContent: "center" }}
      >
        <Text style={[authType.help, { color: label3, textAlign: "center" }]}>
          Versión de prueba · datos ficticios · sin fines de lucro.{" "}
          <Text style={{ fontWeight: "600", color: label1, textDecorationLine: "underline" }}>Más info</Text>
        </Text>
      </Pressable>
    </View>
  );
}
