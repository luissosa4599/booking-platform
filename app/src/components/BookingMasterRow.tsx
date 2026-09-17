import { Pressable, Text, View } from "react-native";

import { cn } from "@/lib/cn";

interface BookingMasterRowProps {
  resourceName: string;
  metaLabel: string;
  startTimeLabel: string;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}

// Reservas handoff §2.8 — the desktop maestro column's own, more compact row
// (radius 16, 86px time column). Distinct from phone's `BookingCard`: no
// thumbnail, no inline actions — tapping only selects the booking into
// `BookingPane`, which owns every action (Ver pase / Cancelar / Repetir) on
// desktop. Selected treatment mirrors phone's `variant="next"` card
// (tint-wash + 1px tint) — the doc's own "la próxima Y la seleccionada
// coinciden al entrar" note.
export function BookingMasterRow({
  resourceName,
  metaLabel,
  startTimeLabel,
  selected,
  onPress,
  accessibilityLabel,
}: BookingMasterRowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel ?? resourceName}
      // `rounded-list-row` as a className rendered dead-square corners — same
      // arbitrary/custom-radius-key gotcha documented throughout this
      // codebase (e.g. `rounded-sheet`/`bg-sheet`). Inline style instead.
      style={{ borderRadius: 16 }}
      className={cn(
        "flex-row items-center gap-[14px] border px-[14px] py-3",
        selected ? "border-tint bg-tint-wash" : "border-transparent bg-card",
      )}
    >
      <View style={{ minWidth: 86 }}>
        <Text
          className={selected ? "text-tint-press" : "text-label-1"}
          style={{ fontSize: 13, fontWeight: "600", fontVariant: ["tabular-nums"] }}
        >
          {startTimeLabel}
        </Text>
      </View>
      <View className="flex-1 gap-0.5">
        <Text numberOfLines={1} className="text-label-1" style={{ fontSize: 14, fontWeight: "600" }}>
          {resourceName}
        </Text>
        <Text numberOfLines={1} className="text-label-3" style={{ fontSize: 12 }}>
          {metaLabel}
        </Text>
      </View>
    </Pressable>
  );
}
