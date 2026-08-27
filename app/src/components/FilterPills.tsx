import { Pressable, ScrollView, Text, View } from "react-native";

import { cn } from "@/lib/cn";
import { X } from "@/lib/icons";
import { useColor } from "@/lib/theme/useColor";

export interface FilterPillOption {
  /** null = "Cualquiera" (no filter). */
  id: string | null;
  label: string;
}

interface FilterPillsProps {
  options: FilterPillOption[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /**
   * Handoff § "FilterPills": inactive pills are `bg-card` when the row sits on
   * a canvas screen, `bg-fill` when it sits on a card. Default "canvas".
   */
  surface?: "canvas" | "card";
  /**
   * Handoff § "FilterPills": the removable variant — the active (non-"Cualquiera")
   * pill gets a trailing `×`; tapping the `×` clears the filter, tapping the
   * rest is a no-op here (there's no per-filter editor on this screen yet).
   */
  removable?: boolean;
}

export function FilterPills({
  options,
  selectedId,
  onSelect,
  surface = "canvas",
  removable = false,
}: FilterPillsProps) {
  // `canvas` is the inverse of `label-1` (the active pill's bg) — matches the
  // active label's `text-canvas`.
  const removeColor = useColor("canvas");

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
    >
      {options.map((option) => {
        const active = option.id === selectedId;
        const showRemove = removable && active && option.id !== null;

        return (
          <Pressable
            key={option.id ?? "all"}
            // No per-filter editor on this screen, so an active removable pill
            // is a single "clear this filter" target — tapping anywhere on it
            // (label or ×) clears. A nested Pressable for the × alone would
            // render as a <button> inside a <button> on web (see Row.tsx).
            onPress={() => onSelect(showRemove ? null : option.id)}
            accessibilityRole="button"
            accessibilityLabel={
              showRemove ? `Quitar filtro ${option.label}` : option.label
            }
            accessibilityState={{ selected: active }}
            hitSlop={{ top: 5, bottom: 5, left: 8, right: 8 }}
            className={cn(
              "h-[34px] flex-row items-center justify-center rounded-full px-[14px]",
              showRemove ? "gap-2" : undefined,
              active
                ? "bg-label-1"
                : surface === "card"
                  ? "bg-fill"
                  : "bg-card",
            )}
          >
            <Text
              className={cn(
                "text-[15px] font-medium",
                // Active pill bg is `label-1`, which flips near-black→white
                // between themes; the label follows `canvas` (its inverse) so
                // it stays readable in dark instead of white-on-white.
                active ? "text-canvas" : "text-label-2",
              )}
            >
              {option.label}
            </Text>
            {showRemove ? (
              // Color class on the wrapping View, not the icon — see lib/icons.ts.
              // `canvas` is the inverse of `label-1`, matching the active label.
              <View className="text-canvas opacity-70">
                <X size={15} color={removeColor} />
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
