import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { BrandMark } from "@/components/BrandMark";
import { cn } from "@/lib/cn";
import { ChevronRight } from "@/lib/icons";
import { useColor } from "@/lib/theme/useColor";

interface HostCtaProps {
  onPress: () => void;
}

// Reservas/Tú handoff §3.4 — the only tint-bordered, tint-chevroned row on
// the screen (deliberately not the neutral `chevron` token). Guest-only pitch
// for becoming a host (2026-09-18 report: "que publica tu espacio solo salga
// si no eres anfitrion todavia") — ProfileContent no longer renders this at
// all once `role === "host"`, since a host already has their own "Espacios"
// tab for exactly this.
export function HostCta({ onPress }: HostCtaProps) {
  const tint = useColor("tint");
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel="Publica tu espacio. Renta salas, escritorios o lo que quieras"
      className={cn(
        "flex-row items-center gap-4 rounded-group border border-tint p-[18px]",
        pressed ? "bg-tint-wash" : "bg-card",
      )}
    >
      {/* No `bg-tint-wash` here — `BrandMark` paints its own background
          (the icon's actual dark square, per tempo-icon.svg), just clipped
          to a circle. Layering the wash behind it would show through the
          gap at the circle's corners for no reason. */}
      <View
        className="items-center justify-center overflow-hidden rounded-full"
        style={{ width: 48, height: 48 }}
      >
        <BrandMark size={48} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="text-body-emph text-label-1">Publica tu espacio</Text>
        <Text numberOfLines={2} className="text-footnote text-label-3">
          Renta salas, escritorios o lo que quieras
        </Text>
      </View>
      <ChevronRight size={20} color={tint} />
    </Pressable>
  );
}
