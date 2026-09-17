import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";

import { Button } from "@/components/Button";
import type { ColorToken } from "@/lib/theme/palette";
import { useColor, useIsDark } from "@/lib/theme/useColor";

export type BookingCardVariant = "next" | "default" | "waitlist" | "past";

export interface BookingCardProps {
  variant: BookingCardVariant;
  resourceName: string;
  /** Already formatted by the caller — e.g. "1 persona · Facultad de
   * Ingeniería" (`variant="past"` adds the full date: "jue 10 de sep · 12
   * personas"). BookingCard is presentation-only, same convention as
   * ResourceCard's `timeLabel`/`capacityLabel`. */
  metaLabel: string;
  startTimeLabel: string;
  endTimeLabel: string;
  /** `variant="next"` only — the 48px thumbnail (§1: "la foto solo aparece
   * en la próxima reserva"). */
  imageUrl?: string | null;
  onViewPass?: () => void;
  onCancel?: () => void;
  onRepeat?: () => void;
  cancelLoading?: boolean;
  viewPassLoading?: boolean;
  /** Every card on screen otherwise shares the literal "Cancelar"/"Ver
   * pase"/"Repetir" accessibleLabel — ambiguous for a screen reader with
   * several cards on the list. Caller passes a resource+schedule-qualified
   * string, same convention the old Row-based cards used. */
  cancelAccessibilityLabel?: string;
  viewPassAccessibilityLabel?: string;
  repeatAccessibilityLabel?: string;
  /** `variant="next"` only — §2.7 "reserva en curso": the time label switches
   * to `state-free` instead of `tint` (caller passes "En curso" /
   * "termina 11:00" as the two time labels). */
  inProgress?: boolean;
}

// Reservas handoff §2.5 — the one new component of this delivery. Radius 18
// (inline `style`, not a className — see tailwind.config.js's borderRadius
// comment), not `rounded-group`'s 22 — declared deviation, too many cards
// per screen at 22 reads as loose blocks. Time column `min-width: 92px`
// everywhere.
export function BookingCard(props: BookingCardProps) {
  switch (props.variant) {
    case "next":
      return <NextCard {...props} />;
    case "waitlist":
      return <WaitlistCard {...props} />;
    case "past":
      return <PastCard {...props} />;
    default:
      return <DefaultCard {...props} />;
  }
}

function withAlpha(color: string, alpha: number): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color.trim());
  if (!m) return color;
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h!, 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function NextCard({
  resourceName,
  metaLabel,
  startTimeLabel,
  endTimeLabel,
  imageUrl,
  onViewPass,
  onCancel,
  viewPassLoading,
  cancelLoading,
  inProgress = false,
  cancelAccessibilityLabel,
  viewPassAccessibilityLabel,
}: BookingCardProps) {
  const isDark = useIsDark();
  const tint = useColor("tint");
  const tintPress = useColor("tint-press");
  const stateFree = useColor("state-free");

  const startColor = inProgress ? stateFree : undefined;
  const endColor = inProgress ? stateFree : isDark ? withAlpha(tint, 0.8) : tintPress;

  return (
    // `rounded-card-compact` as a className generates no rule at all — same
    // silent-no-op gotcha confirmed elsewhere in this file/session. Inline.
    <View
      className="gap-[14px] border border-tint bg-tint-wash p-4"
      style={{ borderRadius: 18 }}
    >
      <View className="flex-row gap-[14px]">
        <View style={{ minWidth: 92 }}>
          <Text
            className={inProgress ? undefined : "text-tint"}
            style={{
              fontSize: 17,
              fontWeight: "700",
              letterSpacing: -0.17,
              fontVariant: ["tabular-nums"],
              color: startColor,
            }}
          >
            {startTimeLabel}
          </Text>
          <Text
            style={{
              fontSize: 13,
              fontVariant: ["tabular-nums"],
              // Light: tint-press. Dark: tint@80% — tint-press's own dark
              // value reads as too dark on tint-wash's dark background.
              // In-progress: state-free in both schemes (§2.7).
              color: endColor,
            }}
          >
            {endTimeLabel}
          </Text>
        </View>

        <View className="flex-1 gap-0.5">
          <Text
            numberOfLines={2}
            className="text-label-1"
            style={{ fontSize: 17, fontWeight: "600", letterSpacing: -0.17 }}
          >
            {resourceName}
          </Text>
          {/* Dark: label-2, not label-3 — label-3 loses contrast on
              tint-wash's dark (#40200B) background. */}
          <Text
            numberOfLines={1}
            className={isDark ? "text-label-2" : "text-label-3"}
            style={{ fontSize: 13 }}
          >
            {metaLabel}
          </Text>
        </View>

        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={{ width: 48, height: 48, borderRadius: 12 }}
            contentFit="cover"
          />
        ) : null}
      </View>

      <View className="flex-row gap-[14px]">
        <View className="flex-1">
          <Button
            variant="filled"
            loading={viewPassLoading}
            onPress={onViewPass}
            accessibilityLabel={viewPassAccessibilityLabel}
          >
            Ver pase
          </Button>
        </View>
        <View className="flex-1">
          <NextSecondaryButton
            loading={cancelLoading}
            onPress={onCancel}
            accessibilityLabel={cancelAccessibilityLabel}
          >
            Cancelar
          </NextSecondaryButton>
        </View>
      </View>
    </View>
  );
}

// Neither of Button's existing variants produces this exact pairing (light:
// card+hairline border/label-2; dark: rgba(white,.10) with no border/label-1)
// — "gray" resolves to the `fill` token in both schemes, and the dark case
// here needs a literal translucent white that isn't a palette token at all.
// Hand-rolled rather than stretching Button's token-dictionary model for one
// spot — same shape (52px, rounded-button) so it still sits flush next to
// the primary "Ver pase" button.
function NextSecondaryButton({
  children,
  onPress,
  loading,
  accessibilityLabel,
}: {
  children: string;
  onPress?: () => void;
  loading?: boolean;
  accessibilityLabel?: string;
}) {
  const isDark = useIsDark();
  const cardColor = useColor("card");
  const hairline = useColor("hairline");
  const label1 = useColor("label-1");
  const label2 = useColor("label-2");

  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? children}
      className="h-[52px] items-center justify-center rounded-button px-4"
      style={{
        backgroundColor: isDark ? "rgba(255,255,255,0.10)" : cardColor,
        borderWidth: isDark ? 0 : 1,
        borderColor: hairline,
      }}
    >
      <Text style={{ color: isDark ? label1 : label2, fontSize: 15, fontWeight: "600" }}>
        {children}
      </Text>
    </Pressable>
  );
}

// Shared by default/waitlist/past — a plain colored text link with a 44px
// touch target via hitSlop rather than visible padding, per §2.5b's "área
// táctil de 44px alto... altura visual sin cambio".
function CardTextAction({
  children,
  color,
  weight,
  onPress,
  loading,
  accessibilityLabel,
}: {
  children: string;
  color: ColorToken;
  weight: "500" | "600";
  onPress?: () => void;
  loading?: boolean;
  accessibilityLabel?: string;
}) {
  const resolved = useColor(color);
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      hitSlop={{ top: 12, bottom: 12 }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? children}
    >
      <Text style={{ color: resolved, fontSize: 14, fontWeight: weight }}>{children}</Text>
    </Pressable>
  );
}

function DefaultCard({
  resourceName,
  metaLabel,
  startTimeLabel,
  endTimeLabel,
  onViewPass,
  onCancel,
  viewPassLoading,
  cancelLoading,
  cancelAccessibilityLabel,
  viewPassAccessibilityLabel,
}: BookingCardProps) {
  return (
    // `rounded-card-compact` — see NextCard's comment above.
    <View className="border border-hairline bg-card" style={{ borderRadius: 18 }}>
      <View className="flex-row items-center gap-[14px] px-4 py-[14px]">
        <View style={{ minWidth: 92 }}>
          <Text
            className="text-label-1"
            style={{ fontSize: 15, fontWeight: "600", fontVariant: ["tabular-nums"] }}
          >
            {startTimeLabel}
          </Text>
          <Text className="text-label-4" style={{ fontSize: 12, fontVariant: ["tabular-nums"] }}>
            {endTimeLabel}
          </Text>
        </View>
        <View className="flex-1 gap-0.5">
          <Text
            numberOfLines={2}
            className="text-label-1"
            style={{ fontSize: 16, fontWeight: "600", letterSpacing: -0.16 }}
          >
            {resourceName}
          </Text>
          <Text numberOfLines={1} className="text-label-3" style={{ fontSize: 13 }}>
            {metaLabel}
          </Text>
        </View>
      </View>
      {/* marginLeft: 106 = 92 (time column) + 14 (gap) — aligns with the name. */}
      {/* gap-[18px] as a className silently generated no rule (confirmed via
          screenshot: "Ver paseCancelar" ran together) — same arbitrary-value
          gotcha documented throughout this codebase. Inline style instead. */}
      <View className="flex-row pb-[14px] pr-4" style={{ marginLeft: 106, gap: 18 }}>
        {onViewPass ? (
          <CardTextAction
            color="tint"
            weight="600"
            loading={viewPassLoading}
            onPress={onViewPass}
            accessibilityLabel={viewPassAccessibilityLabel}
          >
            Ver pase
          </CardTextAction>
        ) : null}
        {onCancel ? (
          <CardTextAction
            color="label-2"
            weight="500"
            loading={cancelLoading}
            onPress={onCancel}
            accessibilityLabel={cancelAccessibilityLabel}
          >
            Cancelar
          </CardTextAction>
        ) : null}
      </View>
    </View>
  );
}

// §2.5c describes "Ver pase" rendering disabled inside the card, but the
// approved screenshot (1b-reservas-phone-light/dark.png) shows a single-row
// EN ESPERA card with only a "Cancelar" trailing action and no "Ver pase"
// text anywhere — screenshots win over the prose here (repo convention:
// verify against real captures, not re-derive from a description). Hora y
// nombre both drop to label-2 per §2.5c.
function WaitlistCard({
  resourceName,
  metaLabel,
  startTimeLabel,
  endTimeLabel,
  onCancel,
  cancelLoading,
  cancelAccessibilityLabel,
}: BookingCardProps) {
  return (
    // `rounded-card-compact` — see NextCard's comment above.
    <View
      className="flex-row items-center gap-[14px] border border-hairline bg-card px-4 py-[14px]"
      style={{ borderRadius: 18 }}
    >
      <View style={{ minWidth: 92 }}>
        <Text
          className="text-label-2"
          style={{ fontSize: 15, fontWeight: "600", fontVariant: ["tabular-nums"] }}
        >
          {startTimeLabel}
        </Text>
        <Text className="text-label-4" style={{ fontSize: 12, fontVariant: ["tabular-nums"] }}>
          {endTimeLabel}
        </Text>
      </View>
      <View className="flex-1 gap-0.5">
        <Text numberOfLines={2} className="text-label-2" style={{ fontSize: 16, fontWeight: "600" }}>
          {resourceName}
        </Text>
        <Text numberOfLines={1} className="text-label-3" style={{ fontSize: 13 }}>
          {metaLabel}
        </Text>
      </View>
      {onCancel ? (
        <CardTextAction
          color="label-2"
          weight="500"
          loading={cancelLoading}
          onPress={onCancel}
          accessibilityLabel={cancelAccessibilityLabel}
        >
          Cancelar
        </CardTextAction>
      ) : null}
    </View>
  );
}

function PastCard({
  resourceName,
  metaLabel,
  startTimeLabel,
  endTimeLabel,
  onRepeat,
  repeatAccessibilityLabel,
}: BookingCardProps) {
  return (
    // `rounded-card-compact` — see NextCard's comment above.
    <View className="border border-hairline bg-card" style={{ borderRadius: 18 }}>
      <View className="flex-row items-center gap-[14px] px-4 py-[14px]">
        <View style={{ minWidth: 92 }}>
          <Text
            className="text-label-2"
            style={{ fontSize: 15, fontWeight: "600", fontVariant: ["tabular-nums"] }}
          >
            {startTimeLabel}
          </Text>
          <Text className="text-label-4" style={{ fontSize: 12, fontVariant: ["tabular-nums"] }}>
            {endTimeLabel}
          </Text>
        </View>
        <View className="flex-1 gap-0.5">
          <Text numberOfLines={2} className="text-label-1" style={{ fontSize: 16, fontWeight: "600" }}>
            {resourceName}
          </Text>
          <Text numberOfLines={1} className="text-label-3" style={{ fontSize: 13 }}>
            {metaLabel}
          </Text>
        </View>
      </View>
      <View className="pb-[14px] pr-4" style={{ marginLeft: 106 }}>
        {onRepeat ? (
          <CardTextAction
            color="tint"
            weight="600"
            onPress={onRepeat}
            accessibilityLabel={repeatAccessibilityLabel}
          >
            Repetir
          </CardTextAction>
        ) : null}
      </View>
    </View>
  );
}
