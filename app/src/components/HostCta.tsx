import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { cn } from "@/lib/cn";
import { ChevronRight, Home } from "@/lib/icons";
import { useColor } from "@/lib/theme/useColor";

interface HostCtaProps {
  /**
   * Real published-space count from `useOwnerSpaces(userId).data.length`.
   * `null`/`undefined` (or a guest) renders the "Publica tu espacio" pitch;
   * a positive count renders "Tus espacios publicados · N espacios" — no
   * "N reservas este mes" clause, since no backend aggregate exists for
   * that figure and it isn't being fabricated (declared deviation, see the
   * plan's §3.4 note).
   */
  spaceCount?: number | null;
  onPress: () => void;
}

// Reservas/Tú handoff §3.4 — the only tint-bordered, tint-chevroned row on
// the screen (deliberately not the neutral `chevron` token).
export function HostCta({ spaceCount, onPress }: HostCtaProps) {
  const tint = useColor("tint");
  const [pressed, setPressed] = useState(false);
  const isActive = spaceCount != null && spaceCount > 0;

  const title = isActive ? "Tus espacios publicados" : "Publica tu espacio";
  const subtitle = isActive
    ? `${spaceCount} ${spaceCount === 1 ? "espacio publicado" : "espacios publicados"}`
    : "Renta salas, escritorios o lo que quieras";

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      className={cn(
        "flex-row items-center gap-4 rounded-group border border-tint p-[18px]",
        pressed ? "bg-tint-wash" : "bg-card",
      )}
    >
      <View
        className="items-center justify-center rounded-full bg-tint-wash"
        style={{ width: 48, height: 48 }}
      >
        <Home size={22} strokeWidth={1.8} color={tint} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="text-body-emph text-label-1">{title}</Text>
        <Text numberOfLines={2} className="text-footnote text-label-3">
          {subtitle}
        </Text>
      </View>
      <ChevronRight size={20} color={tint} />
    </Pressable>
  );
}
