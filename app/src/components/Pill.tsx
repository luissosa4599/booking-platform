import { Pressable, Text } from "react-native";

import { cn } from "@/lib/cn";
import { useColor } from "@/lib/theme/useColor";

interface PillProps {
  active: boolean;
  label: string;
  /** Shown as "label · count" — only the active pill carries one (§2.3:
   * "Anteriores va sin conteo"). */
  count?: number;
  size?: "phone" | "desktop";
  onPress: () => void;
  accessibilityLabel?: string;
}

// Reservas handoff §2.3 (phone) / §2.8 (desktop master column). Not
// FilterPills (active = bg-label-1/text-canvas, a different "selected
// filter" semantic) and not SegmentedControl (a single sliding pill behind
// fixed labels — kept untouched for the resource-detail day selector, §4.3).
// This is the plain bg-tint/text-on-tint pill already used for Explorar's
// category chips.
export function Pill({
  active,
  label,
  count,
  size = "phone",
  onPress,
  accessibilityLabel,
}: PillProps) {
  const tint = useColor("tint");
  const onTint = useColor("on-tint");

  const text = count != null ? `${label} · ${count}` : label;
  const fontSize = size === "phone" ? 14 : 13;
  const paddingHorizontal = size === "phone" ? 18 : 16;
  const paddingVertical = size === "phone" ? 9 : 8;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={accessibilityLabel ?? text}
      // Visual height stays 38px (padding-driven); the touch target grows to
      // 44px via hitSlop instead, per §2.3's "no crecer visualmente" — same
      // trick Button.tsx's own pill variant already uses.
      hitSlop={{ top: 6, bottom: 6 }}
      className={cn("rounded-full", active ? undefined : "border border-hairline bg-card")}
      style={{
        paddingHorizontal,
        paddingVertical,
        backgroundColor: active ? tint : undefined,
      }}
    >
      <Text
        style={{ fontSize, fontWeight: active ? "600" : "500", color: active ? onTint : undefined }}
        className={active ? undefined : "text-label-2"}
      >
        {text}
      </Text>
    </Pressable>
  );
}
