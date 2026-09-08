import { Text, View } from "react-native";

import type { ColorToken } from "@/lib/theme/palette";
import { useColor } from "@/lib/theme/useColor";

export type StatusTone = "free" | "last" | "waiting" | "error";

const TOKEN: Record<StatusTone, ColorToken> = {
  free: "state-free",
  last: "state-last",
  waiting: "state-waiting",
  error: "state-error",
};

// Handoff § "Nuevos (2) · StatusBadge" — read-only status pill: height 32,
// px 14, radius full, fill = the state colour at ~16% opacity, an 8px dot +
// 15/600 text in the full state colour. Not tappable.
export function StatusBadge({ tone, label }: { tone: StatusTone; label: string }) {
  const color = useColor(TOKEN[tone]);
  return (
    <View
      className="flex-row items-center gap-2 self-start"
      style={{
        height: 32,
        paddingHorizontal: 14,
        borderRadius: 9999,
        backgroundColor: withAlpha(color, 0.16),
      }}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text
        style={{ color, fontSize: 15, fontWeight: "600" }}
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
