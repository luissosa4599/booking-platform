import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Sheet } from "@/components/Sheet";
import type { AvailabilitySort } from "@/lib/api/availability";
import { haptics } from "@/lib/haptics";
import { ArrowUpDown, Check } from "@/lib/icons";
import { useColor } from "@/lib/theme/useColor";

const OPTIONS: { value: AvailabilitySort; label: string; hint?: string }[] = [
  { value: "soonest", label: "Disponible antes" },
  { value: "nearest", label: "Más cercano", hint: "Usa tu ubicación" },
  { value: "name", label: "Nombre (A–Z)" },
  { value: "capacity", label: "Más cupo", hint: "Lugares libres ahora" },
];

const SHORT: Record<AvailabilitySort, string> = {
  soonest: "Antes",
  nearest: "Cerca",
  name: "Nombre",
  capacity: "Cupo",
};

interface SortControlProps {
  value: AvailabilitySort;
  onChange: (sort: AvailabilitySort) => void;
  /** Externally controlled sheet — lets another trigger (the redesigned
   * search bar's filter button) open the same sheet. Falls back to internal
   * state when omitted, so every existing call site is unaffected. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SortControl({ value, onChange, open: openProp, onOpenChange }: SortControlProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const triggerColor = useColor("label-2");
  const checkColor = useColor("tint");
  // Inline, not `text-tint-press` — a themeable-token className resolves to
  // nothing inside `Sheet` on web (its content renders through a DOM portal,
  // outside the wrapper element `ThemeProvider`'s `vars()` scopes the 6
  // themeable CSS custom properties to — see CLAUDE.md "Direction A
  // redesign"). The selected option's text silently fell back to the exact
  // same color as every unselected one, so the only visible difference was
  // the checkmark — read as "hiding" the selection, not highlighting it
  // (2026-09-17 report, screenshot of this exact sheet).
  const selectedLabelColor = useColor("tint-press");
  const labelColor = useColor("label-1");

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
                    className="text-body-emph"
                    style={{ color: selected ? selectedLabelColor : labelColor }}
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
