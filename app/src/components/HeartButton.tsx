import { Pressable } from "react-native";

import { haptics } from "@/lib/haptics";
import { Heart } from "@/lib/icons";
import { useColor } from "@/lib/theme/useColor";

interface HeartButtonProps {
  active: boolean;
  onToggle: () => void;
  /** "hero" = the round translucent chip over a photo (mirrors the back
   * button); "inline" = a bare icon sitting in a list row. */
  variant?: "hero" | "inline";
}

export function HeartButton({
  active,
  onToggle,
  variant = "hero",
}: HeartButtonProps) {
  const tint = useColor("tint");
  const restColor = useColor(variant === "hero" ? "label-1" : "label-3");
  const color = active ? tint : restColor;

  function handlePress() {
    haptics.selection();
    onToggle();
  }

  if (variant === "inline") {
    return (
      <Pressable
        onPress={handlePress}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={active ? "Quitar de favoritos" : "Guardar en favoritos"}
        accessibilityState={{ selected: active }}
        className="h-9 w-9 items-center justify-center"
      >
        <Heart size={19} color={color} fill={active ? tint : "none"} />
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={active ? "Quitar de favoritos" : "Guardar en favoritos"}
      accessibilityState={{ selected: active }}
      className="h-9 w-9 items-center justify-center rounded-full bg-card/90"
    >
      <Heart size={17} color={color} fill={active ? tint : "none"} />
    </Pressable>
  );
}
