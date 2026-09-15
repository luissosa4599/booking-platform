import { Pressable, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Sheet } from "@/components/Sheet";
import { cn } from "@/lib/cn";
import { haptics } from "@/lib/haptics";
import { Minus, Plus } from "@/lib/icons";
import { useColor } from "@/lib/theme/useColor";

const DISTANCE_OPTIONS_KM: { value: number | null; label: string }[] = [
  { value: null, label: "Cualquiera" },
  { value: 1, label: "1 km" },
  { value: 3, label: "3 km" },
  { value: 5, label: "5 km" },
  { value: 10, label: "10 km" },
];

export interface FilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  minCapacity: number;
  onMinCapacityChange: (value: number) => void;
  /** null = no distance limit. Only meaningful once the device position is
   * known — a real value with no location just silently filters nothing. */
  maxDistanceKm: number | null;
  onMaxDistanceKmChange: (value: number | null) => void;
  /** Whether device location is available — greys out the distance options
   * with an explanatory line instead of silently doing nothing. */
  locationAvailable: boolean;
  onClear: () => void;
}

// Separate from SortControl's sheet on purpose (2026-09-14 report: "filtros y
// ordenamientos abren el mismo modal") — sorting changes the ORDER of the
// same results; filtering changes WHICH results show up at all. Distance is
// a client-side filter over already-fetched slots (no new backend param —
// `distanceMeters`/coords are already in every `AvailabilitySlot`); capacity
// uses `/availability`'s existing `minCapacity` query param, already wired,
// just never exposed in the UI before.
export function FilterSheet({
  isOpen,
  onClose,
  minCapacity,
  onMinCapacityChange,
  maxDistanceKm,
  onMaxDistanceKmChange,
  locationAvailable,
  onClear,
}: FilterSheetProps) {
  const stepperIconColor = useColor("label-1");
  const hasFilters = minCapacity > 0 || maxDistanceKm != null;

  return (
    <Sheet isOpen={isOpen} onClose={onClose}>
      <View style={{ gap: 24 }}>
        <Text className="text-title-sm text-label-1">Filtros</Text>

        <View style={{ gap: 10 }}>
          <View className="flex-row items-center justify-between">
            <Text className="text-body-emph text-label-1">Aforo mínimo</Text>
            <View
              className="flex-row items-center rounded-control border border-hairline"
              style={{ padding: 3 }}
            >
              <Pressable
                onPress={() => {
                  haptics.selection();
                  onMinCapacityChange(Math.max(0, minCapacity - 1));
                }}
                disabled={minCapacity <= 0}
                accessibilityRole="button"
                accessibilityLabel="Reducir aforo mínimo"
                className={cn(
                  "items-center justify-center rounded-control-inner bg-fill",
                  minCapacity <= 0 ? "opacity-40" : undefined,
                )}
                style={{ width: 34, height: 30 }}
              >
                <Minus size={16} color={stepperIconColor} />
              </Pressable>
              <Text
                className="text-center text-body-emph text-label-1"
                style={{ width: 44, fontVariant: ["tabular-nums"] }}
              >
                {minCapacity > 0 ? minCapacity : "—"}
              </Text>
              <Pressable
                onPress={() => {
                  haptics.selection();
                  onMinCapacityChange(minCapacity + 1);
                }}
                accessibilityRole="button"
                accessibilityLabel="Aumentar aforo mínimo"
                className="items-center justify-center rounded-control-inner bg-fill"
                style={{ width: 34, height: 30 }}
              >
                <Plus size={16} color={stepperIconColor} />
              </Pressable>
            </View>
          </View>
          <Text className="text-footnote text-label-3">
            {minCapacity > 0
              ? `Solo lugares con al menos ${minCapacity} ${minCapacity === 1 ? "persona" : "personas"}.`
              : "Sin mínimo — muestra lugares de cualquier tamaño."}
          </Text>
        </View>

        <View style={{ gap: 10 }}>
          <Text className="text-body-emph text-label-1">Distancia</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {DISTANCE_OPTIONS_KM.map((opt) => {
              const active = opt.value === maxDistanceKm;
              return (
                <Pressable
                  key={opt.label}
                  onPress={() => {
                    haptics.selection();
                    onMaxDistanceKmChange(opt.value);
                  }}
                  disabled={!locationAvailable}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  className={cn(
                    "h-[34px] flex-row items-center justify-center rounded-full px-[14px]",
                    !locationAvailable ? "opacity-40" : undefined,
                    active ? "bg-label-1" : "bg-fill",
                  )}
                >
                  <Text
                    className={cn("text-subhead", active ? "text-canvas" : "text-label-2")}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {!locationAvailable ? (
            <Text className="text-footnote text-label-3">
              Activa tu ubicación para filtrar por distancia.
            </Text>
          ) : null}
        </View>

        <View style={{ gap: 10 }}>
          <Button variant="filled" onPress={onClose}>
            Aplicar
          </Button>
          {hasFilters ? (
            <Button variant="plain" onPress={onClear}>
              Quitar filtros
            </Button>
          ) : null}
        </View>
      </View>
    </Sheet>
  );
}
