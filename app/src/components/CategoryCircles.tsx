import type { ComponentType } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { cn } from "@/lib/cn";
import type { IconProps } from "@/lib/icons";
import { useColor } from "@/lib/theme/useColor";

export interface CategoryOption {
  /** null = "Cualquiera" (no filter) — same convention as FilterPillOption. */
  id: string | null;
  label: string;
  icon: ComponentType<IconProps>;
}

interface CategoryCirclesProps {
  options: CategoryOption[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** 54 (teléfono) or 48 (columna maestra de escritorio) — handoff §3.4. */
  circleSize?: 54 | 48;
}

// Redesign handoff §5 — replaces `FilterPills` on Explore only (same
// selection API: `options`/`selectedId`/`onSelect`). `FilterPills` itself
// stays for every other screen — not deprecated app-wide, just here.
export function CategoryCircles({
  options,
  selectedId,
  onSelect,
  circleSize = 54,
}: CategoryCirclesProps) {
  const activeIconColor = useColor("on-tint");
  const idleIconColor = useColor("label-3");

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16 }}
    >
      {/* `gap` on a horizontal ScrollView's contentContainerStyle doesn't
          render on Android — a plain row View, same fix as FilterPills. */}
      <View style={{ flexDirection: "row", gap: 14 }}>
        {options.map((option) => {
          const active = option.id === selectedId;
          const Icon = option.icon;
          return (
            <Pressable
              key={option.id ?? "all"}
              onPress={() => onSelect(option.id)}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              accessibilityState={{ selected: active }}
              className="items-center gap-1.5"
              style={{ width: 60 }}
            >
              <View
                className={cn(
                  "items-center justify-center rounded-full",
                  active ? "bg-tint" : "border border-hairline bg-card",
                )}
                style={{ width: circleSize, height: circleSize }}
              >
                <Icon
                  size={circleSize === 54 ? 22 : 20}
                  strokeWidth={1.8}
                  color={active ? activeIconColor : idleIconColor}
                />
              </View>
              <Text
                numberOfLines={1}
                className={cn(
                  "text-[11px]",
                  active ? "font-semibold text-label-1" : "text-label-3",
                )}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}
