import { Pressable, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Sheet } from "@/components/Sheet";
import { Slider } from "@/components/Slider";
import { cn } from "@/lib/cn";
import { haptics } from "@/lib/haptics";

const MIN_CAPACITY = 1;
const MAX_CAPACITY = 100;
const MIN_DISTANCE_KM = 1;
const MAX_DISTANCE_KM = 100;

export interface FilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  minCapacity: number;
  onMinCapacityChange: (value: number) => void;
  /** null = no distance limit. Only meaningful once the device position is
   * known — a real value with no location just silently filters nothing. */
  maxDistanceKm: number | null;
  onMaxDistanceKmChange: (value: number | null) => void;
  /** Whether device location is available — greys out the distance slider
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
//
// Both are real draggable sliders (2026-09-14 report: "haz que sean slides
// deslizables de ambos sentidos, km 1 a 100km, aforo de 1 a 100 personas") —
// replaced the earlier +-stepper / preset-pill controls. `minCapacity`/
// `maxDistanceKm` at their unset value (0 / null) still means "no filter";
// the slider itself only ever shows/produces a real 1-100 value, and a
// "Cualquiera" chip is the way back to unset.
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
  const hasFilters = minCapacity > 0 || maxDistanceKm != null;

  return (
    <Sheet isOpen={isOpen} onClose={onClose}>
      <View style={{ gap: 24 }}>
        <Text className="text-title-sm text-label-1">Filtros</Text>

        <View style={{ gap: 12 }}>
          <View className="flex-row items-center justify-between">
            <Text className="text-body-emph text-label-1">Aforo mínimo</Text>
            <Text
              className="text-body-emph text-label-1"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {minCapacity > 0 ? `${minCapacity} ${minCapacity === 1 ? "persona" : "personas"}` : "Cualquiera"}
            </Text>
          </View>
          <Slider
            min={MIN_CAPACITY}
            max={MAX_CAPACITY}
            value={minCapacity > 0 ? minCapacity : MIN_CAPACITY}
            onChange={(v) => {
              haptics.selection();
              onMinCapacityChange(v);
            }}
            accessibilityLabel="Aforo mínimo"
          />
          <View className="flex-row items-center justify-between">
            <Text className="text-footnote text-label-3">{MIN_CAPACITY}</Text>
            {minCapacity > 0 ? (
              <Pressable onPress={() => onMinCapacityChange(0)}>
                <Text className="text-footnote text-label-3" style={{ textDecorationLine: "underline" }}>
                  Cualquiera
                </Text>
              </Pressable>
            ) : null}
            <Text className="text-footnote text-label-3">{MAX_CAPACITY}</Text>
          </View>
        </View>

        <View style={{ gap: 12 }}>
          <View className="flex-row items-center justify-between">
            <Text className={cn("text-body-emph text-label-1", !locationAvailable ? "opacity-40" : undefined)}>
              Distancia
            </Text>
            <Text
              className={cn(
                "text-body-emph text-label-1",
                !locationAvailable ? "opacity-40" : undefined,
              )}
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {maxDistanceKm != null ? `${maxDistanceKm} km` : "Cualquiera"}
            </Text>
          </View>
          <Slider
            min={MIN_DISTANCE_KM}
            max={MAX_DISTANCE_KM}
            value={maxDistanceKm ?? MIN_DISTANCE_KM}
            disabled={!locationAvailable}
            onChange={(v) => {
              haptics.selection();
              onMaxDistanceKmChange(v);
            }}
            accessibilityLabel="Distancia máxima"
          />
          <View className="flex-row items-center justify-between">
            <Text
              className={cn("text-footnote text-label-3", !locationAvailable ? "opacity-40" : undefined)}
            >
              {MIN_DISTANCE_KM} km
            </Text>
            {maxDistanceKm != null ? (
              <Pressable onPress={() => onMaxDistanceKmChange(null)}>
                <Text className="text-footnote text-label-3" style={{ textDecorationLine: "underline" }}>
                  Cualquiera
                </Text>
              </Pressable>
            ) : null}
            <Text
              className={cn("text-footnote text-label-3", !locationAvailable ? "opacity-40" : undefined)}
            >
              {MAX_DISTANCE_KM} km
            </Text>
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
