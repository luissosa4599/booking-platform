import { useMemo } from "react";
import { Text, View } from "react-native";

import type { AvailabilitySlot } from "@/lib/api/types";
import { useColor } from "@/lib/theme/useColor";

const BUCKETS = 12; // 15-min buckets over the next 3 hours
const SPAN_MS = 3 * 60 * 60 * 1000;
const BUCKET_MS = SPAN_MS / BUCKETS;

function hourTick(d: Date): string {
  const h = d.getHours();
  const period = h < 12 ? "a" : "p";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${period}`;
}

/**
 * The "próximas 3 h" strip (PR #11 follow-up) — a small bar chart of the wave
 * of capacity opening and closing over the next three hours. Tablet/desktop
 * only; on phone the now/later grouping already carries this. Design:
 * claude.ai/code/artifact/3e699a91 (`.timeline`).
 */
export function Timeline({ slots, now }: { slots: AvailabilitySlot[]; now: Date }) {
  const barColor = useColor("tint");
  const tickColor = useColor("label-4");

  const bars = useMemo(() => {
    const start = now.getTime();
    const totals = new Array(BUCKETS).fill(0);
    for (const slot of slots) {
      const t = new Date(slot.startsAt).getTime();
      const offset = t - start;
      // Slots already in progress count toward the first bucket.
      const idx = offset < 0 ? 0 : Math.floor(offset / BUCKET_MS);
      if (idx >= 0 && idx < BUCKETS) totals[idx] += Math.max(slot.capacityRemaining, 0);
    }
    const max = Math.max(1, ...totals);
    return totals.map((v) => {
      const r = v / max;
      return {
        height: v === 0 ? 14 : Math.round(32 + r * 68),
        opacity: v === 0 ? 0.22 : 0.35 + r * 0.55,
      };
    });
  }, [slots, now]);

  const ticks = useMemo(
    () =>
      [0, 1, 2, 3].map((h) => hourTick(new Date(now.getTime() + h * 60 * 60 * 1000))),
    [now],
  );

  return (
    <View className="rounded-[12px] border border-hairline bg-card px-3 py-2.5">
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 3, height: 34 }}>
        {bars.map((b, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: `${b.height}%`,
              opacity: b.opacity,
              backgroundColor: barColor,
              borderRadius: 2,
            }}
          />
        ))}
      </View>
      <View className="mt-1.5 flex-row justify-between">
        {ticks.map((t, i) => (
          <Text
            key={i}
            style={{
              fontFamily: "SpaceGrotesk_500Medium",
              fontSize: 10,
              color: tickColor,
              fontVariant: ["tabular-nums"],
            }}
          >
            {t}
          </Text>
        ))}
      </View>
    </View>
  );
}
