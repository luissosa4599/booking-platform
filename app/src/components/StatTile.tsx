import { Text, View } from "react-native";

import { useColor, useIsDark } from "@/lib/theme/useColor";

interface StatTileProps {
  value: number;
  label: string;
  loading?: boolean;
}

// Reservas/Tú handoff §3.3 — two of these in a `flex-row gap-3`. §3.6: a
// value of 0 still renders "0" in tint, never an empty/hidden card.
export function StatTile({ value, label, loading = false }: StatTileProps) {
  const isDark = useIsDark();
  // "Rótulo: tint-press en claro, tint en oscuro" — not just tint-press's own
  // dark value (which is a different, darker color from what the doc wants
  // here), an explicit token swap by color scheme.
  const labelColor = useColor(isDark ? "tint" : "tint-press");

  // "Números de 3+ dígitos: el número baja a 28px automático... nunca hace wrap."
  const numberSize = String(value).length >= 3 ? 28 : 34;

  return (
    // `rounded-card-compact` as a className generated no rule at all
    // (confirmed via getComputedStyle: borderRadius stayed "0px" while the
    // rest of this same class string, bg-tint-wash, applied fine) — same
    // silent-no-op custom-radius-key gotcha as `rounded-list-row`/
    // `rounded-sheet` elsewhere in this codebase. Inline style instead.
    <View className="flex-1 gap-2 bg-tint-wash p-4" style={{ borderRadius: 18 }}>
      {loading ? (
        <View className="h-[38px] w-12 rounded-[6px] bg-fill" />
      ) : (
        <Text
          numberOfLines={1}
          className="text-tint"
          style={{
            fontSize: numberSize,
            lineHeight: 38,
            letterSpacing: numberSize * -0.04,
            fontWeight: "700",
            fontVariant: ["tabular-nums"],
          }}
        >
          {value}
        </Text>
      )}
      <Text
        numberOfLines={1}
        className="text-footnote font-medium"
        style={{ color: labelColor }}
      >
        {label}
      </Text>
    </View>
  );
}
