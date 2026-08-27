import { Pressable, ScrollView, Text } from "react-native";

import { cn } from "@/lib/cn";

export interface FilterPillOption {
  /** null = "Cualquiera" (no filter). */
  id: string | null;
  label: string;
}

interface FilterPillsProps {
  options: FilterPillOption[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function FilterPills({ options, selectedId, onSelect }: FilterPillsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
    >
      {options.map((option) => {
        const active = option.id === selectedId;

        return (
          <Pressable
            key={option.id ?? "all"}
            onPress={() => onSelect(option.id)}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: active }}
            hitSlop={{ top: 5, bottom: 5 }}
            className={cn(
              "h-[34px] items-center justify-center rounded-full px-[14px]",
              active ? "bg-label-1" : "bg-card",
            )}
          >
            <Text
              className={cn(
                "text-[15px] font-medium",
                active ? "text-white" : "text-label-2",
              )}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
