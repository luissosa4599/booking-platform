import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Sheet } from "@/components/Sheet";
import type { AvailabilitySort } from "@/lib/api/availability";
import { cn } from "@/lib/cn";
import { haptics } from "@/lib/haptics";
import { ArrowUpDown, Check } from "@/lib/icons";
import { useColor } from "@/lib/theme/useColor";

const OPTIONS: { value: AvailabilitySort; label: string; hint?: string }[] = [
  { value: "soonest", label: "Disponible antes" },
  { value: "nearest", label: "Más cercano", hint: "Usa tu ubicación" },
  { value: "name", label: "Nombre (A–Z)" },
  { value: "capacity", label: "Mayor aforo" },
];

const SHORT: Record<AvailabilitySort, string> = {
  soonest: "Antes",
  nearest: "Cerca",
  name: "Nombre",
  capacity: "Aforo",
};

interface SortControlProps {
  value: AvailabilitySort;
  onChange: (sort: AvailabilitySort) => void;
}

export function SortControl({ value, onChange }: SortControlProps) {
  const [open, setOpen] = useState(false);
  const triggerColor = useColor("label-2");
  const checkColor = useColor("tint");

  return (
    <>
      <Pressable
        onPress={() => {
          haptics.selection();
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Ordenar por ${SHORT[value]}`}
        className="h-[34px] flex-row items-center gap-1.5 rounded-full bg-card px-[14px]"
      >
        <ArrowUpDown size={13} color={triggerColor} />
        <Text className="text-subhead text-label-2">{SHORT[value]}</Text>
      </Pressable>

      <Sheet isOpen={open} onClose={() => setOpen(false)}>
        <View className="gap-1">
          <Text className="mb-2 text-title-sm text-label-1">Ordenar</Text>
          {OPTIONS.map((opt) => {
            const selected = opt.value === value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => {
                  haptics.selection();
                  setOpen(false);
                  if (opt.value !== value) onChange(opt.value);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                className="min-h-[52px] flex-row items-center gap-3 py-2"
              >
                <View className="flex-1">
                  <Text
                    className={cn(
                      "text-body-emph",
                      selected ? "text-tint-press" : "text-label-1",
                    )}
                  >
                    {opt.label}
                  </Text>
                  {opt.hint ? (
                    <Text className="text-subhead text-label-3">{opt.hint}</Text>
                  ) : null}
                </View>
                {selected ? (
                  <Check size={18} strokeWidth={3} color={checkColor} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </>
  );
}
