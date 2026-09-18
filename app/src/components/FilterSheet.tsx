import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Sheet } from "@/components/Sheet";
import { Slider } from "@/components/Slider";
import { cn } from "@/lib/cn";
import { haptics } from "@/lib/haptics";

// Wider than the default 448px `Sheet` centered dialog on web — two full-width
// range sliders read cramped at that width (2026-09-18 report).
const FILTER_SHEET_MAX_WIDTH = 560;

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
//
// **Draft state, applied on "Aplicar" (2026-09-18 report).** Dragging used to
// call `onMinCapacityChange`/`onMaxDistanceKmChange` straight through on every
// touch-move tick — each one flows into `useAvailability`'s query key in
// `(tabs)/index.tsx`, so a drag fired a refetch per pixel of movement. On a
// real device this froze and crashed the app. The sliders now only ever touch
// local `draftMinCapacity`/`draftMaxDistanceKm` state; the parent (and the
// query it drives) only hears about a change when "Aplicar" is pressed. The
// draft re-syncs from the applied props whenever the sheet transitions
// closed→open — a state-based previous-value comparison during render (not a
// `useEffect`, which would trip `react-hooks/set-state-in-effect`; not a ref,
// which `react-hooks/refs` forbids reading during render in this project) —
// the same pattern `ConflictSheet`/`ExploreScreen`'s `prevView` already use.
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
  const [draftMinCapacity, setDraftMinCapacity] = useState(minCapacity);
  const [draftMaxDistanceKm, setDraftMaxDistanceKm] = useState(maxDistanceKm);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (prevIsOpen !== isOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setDraftMinCapacity(minCapacity);
      setDraftMaxDistanceKm(maxDistanceKm);
    }
  }

  const hasDraftFilters = draftMinCapacity > 0 || draftMaxDistanceKm != null;

  function applyAndClose() {
    onMinCapacityChange(draftMinCapacity);
    onMaxDistanceKmChange(draftMaxDistanceKm);
    onClose();
  }

  function clearAll() {
    setDraftMinCapacity(0);
    setDraftMaxDistanceKm(null);
    onClear();
  }

  return (
    <Sheet isOpen={isOpen} onClose={onClose} maxWidth={FILTER_SHEET_MAX_WIDTH}>
      <View style={{ gap: 24 }}>
        <Text className="text-title-sm text-label-1">Filtros</Text>

        <View style={{ gap: 12 }}>
          <View className="flex-row items-center justify-between">
            <Text className="text-body-emph text-label-1">Aforo mínimo</Text>
            <Text
              className="text-body-emph text-label-1"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {draftMinCapacity > 0
                ? `${draftMinCapacity} ${draftMinCapacity === 1 ? "persona" : "personas"}`
                : "Cualquiera"}
            </Text>
          </View>
          <Slider
            min={MIN_CAPACITY}
            max={MAX_CAPACITY}
            value={draftMinCapacity > 0 ? draftMinCapacity : MIN_CAPACITY}
            onChange={(v) => {
              haptics.selection();
              setDraftMinCapacity(v);
            }}
            accessibilityLabel="Aforo mínimo"
          />
          <View className="flex-row items-center justify-between">
            <Text className="text-footnote text-label-3">{MIN_CAPACITY}</Text>
            {draftMinCapacity > 0 ? (
              <Pressable onPress={() => setDraftMinCapacity(0)}>
                <Text className="text-footnote text-label-3" style={{ textDecorationLine: "underline" }}>
                  Cualquiera
                </Text>
              </Pressable>
            ) : null}
            <Text className="text-footnote text-label-3">{MAX_CAPACITY}</Text>
          </View>
        </View>

        <View style={{ gap: 12 }}>
          {/* Dimming via opacity-40 on top of label-1/label-3 used to crush to
              near-invisible on dark canvas (2026-09-19 report, same class of
              bug as resource/[id].tsx's disabled day pills) — a direct swap
              to a more muted label tier (no opacity) instead, so "disabled"
              stays legible in both themes. */}
          <View className="flex-row items-center justify-between">
            <Text className={!locationAvailable ? "text-body-emph text-label-4" : "text-body-emph text-label-1"}>
              Distancia
            </Text>
            <Text
              className={!locationAvailable ? "text-body-emph text-label-4" : "text-body-emph text-label-1"}
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {draftMaxDistanceKm != null ? `${draftMaxDistanceKm} km` : "Cualquiera"}
            </Text>
          </View>
          <Slider
            min={MIN_DISTANCE_KM}
            max={MAX_DISTANCE_KM}
            value={draftMaxDistanceKm ?? MIN_DISTANCE_KM}
            disabled={!locationAvailable}
            onChange={(v) => {
              haptics.selection();
              setDraftMaxDistanceKm(v);
            }}
            accessibilityLabel="Distancia máxima"
          />
          <View className="flex-row items-center justify-between">
            <Text className={cn("text-footnote", !locationAvailable ? "text-label-4" : "text-label-3")}>
              {MIN_DISTANCE_KM} km
            </Text>
            {draftMaxDistanceKm != null ? (
              <Pressable onPress={() => setDraftMaxDistanceKm(null)}>
                <Text className="text-footnote text-label-3" style={{ textDecorationLine: "underline" }}>
                  Cualquiera
                </Text>
              </Pressable>
            ) : null}
            <Text className={cn("text-footnote", !locationAvailable ? "text-label-4" : "text-label-3")}>
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
          <Button variant="filled" onPress={applyAndClose}>
            Aplicar
          </Button>
          {hasDraftFilters ? (
            <Button variant="plain" onPress={clearAll}>
              Quitar filtros
            </Button>
          ) : null}
        </View>
      </View>
    </Sheet>
  );
}
