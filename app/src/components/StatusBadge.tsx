import { Text, View } from "react-native";

import type { ColorToken } from "@/lib/theme/palette";
import { useColor } from "@/lib/theme/useColor";

export type StatusTone = "free" | "last" | "waiting" | "error";
export type StatusBadgeVariant = "inline" | "onPhoto" | "compact" | "solid";

const TOKEN: Record<StatusTone, ColorToken> = {
  free: "state-free",
  last: "state-last",
  waiting: "state-waiting",
  error: "state-error",
};

// Handoff § "Nuevos (2) · StatusBadge" (original) + Explore redesign handoff
// §5/§6 (variants). Always a dot + text — the color is never the only signal.
//
// - `inline` (default): the original — height 32, px 14, wash fill (~16%
//   alpha), 15/600 text. For badges sitting on a `card` background (detail
//   screen, map pin card).
// - `onPhoto`: sits over a photo, where a translucent wash can't guarantee
//   4.5:1 against an arbitrary image — solid `card` background instead.
// - `compact`: the desktop row variant — smaller text/padding, keeps the wash
//   fill (the row already sits on `card`, same contrast case as `inline`).
// - `solid`: Reservas handoff §2.5c — the EN ESPERA section-header badge.
//   Full-opacity tone background + `on-tint` text (the doc's literal pairing,
//   not a per-tone-computed color), no dot — the approved screenshot shows a
//   plain text pill here, not a dot+label like every other variant.
export function StatusBadge({
  tone,
  label,
  variant = "inline",
}: {
  tone: StatusTone;
  label: string;
  variant?: StatusBadgeVariant;
}) {
  const color = useColor(TOKEN[tone]);
  const cardColor = useColor("card");
  const onTintColor = useColor("on-tint");

  const onPhoto = variant === "onPhoto";
  const compact = variant === "compact";
  const solid = variant === "solid";

  if (solid) {
    return (
      <View
        className="flex-row items-center self-start"
        style={{
          paddingVertical: 2,
          paddingHorizontal: 7,
          borderRadius: 9999,
          backgroundColor: color,
        }}
      >
        <Text style={{ color: onTintColor, fontSize: 11, fontWeight: "700" }} numberOfLines={1}>
          {label}
        </Text>
      </View>
    );
  }

  return (
    <View
      className="flex-row items-center self-start"
      style={{
        gap: compact ? 6 : 8,
        height: onPhoto ? 28 : compact ? 22 : 32,
        paddingHorizontal: onPhoto ? 10 : compact ? 9 : 14,
        paddingVertical: compact ? 3 : undefined,
        borderRadius: 9999,
        backgroundColor: onPhoto ? cardColor : withAlpha(color, compact ? 0.16 : 0.16),
      }}
    >
      <View
        style={{
          width: compact ? 6 : 8,
          height: compact ? 6 : 8,
          borderRadius: compact ? 3 : 4,
          backgroundColor: color,
        }}
      />
      <Text
        style={{ color, fontSize: compact ? 12 : onPhoto ? 13 : 15, fontWeight: "600" }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

function withAlpha(color: string, alpha: number): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color.trim());
  if (!m) return color;
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h!, 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
