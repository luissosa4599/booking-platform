import { useState } from "react";
import { Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Sheet } from "@/components/Sheet";

interface CancelBookingSheetProps {
  isOpen: boolean;
  onClose: () => void;
  resourceName: string | null;
  scheduleLabel: string | null;
  onConfirm: () => void;
  confirming?: boolean;
}

// Reservas handoff §2.6 — a new step ahead of the existing undo-toast flow.
// Today, tapping "Cancelar" directly hides the row and starts the 5s undo
// toast; the handoff adds this confirmation sheet in front of that step —
// only the sheet's own confirm button now does what the row's tap used to
// do. Everything downstream (the toast, "Deshacer", the DELETE firing only
// on toast expiry) is unchanged.
//
// Retained-value pattern copied from ConflictSheet.tsx: `isOpen` flips to
// false before the caller's own `resourceName`/`scheduleLabel` go back to
// null, so the sheet needs its own last-known copies to render through the
// close transition.
export function CancelBookingSheet({
  isOpen,
  onClose,
  resourceName,
  scheduleLabel,
  onConfirm,
  confirming = false,
}: CancelBookingSheetProps) {
  const [lastResourceName, setLastResourceName] = useState(resourceName);
  if (resourceName && resourceName !== lastResourceName) {
    setLastResourceName(resourceName);
  }
  const [lastScheduleLabel, setLastScheduleLabel] = useState(scheduleLabel);
  if (scheduleLabel && scheduleLabel !== lastScheduleLabel) {
    setLastScheduleLabel(scheduleLabel);
  }

  return (
    <Sheet isOpen={isOpen} onClose={onClose}>
      <View className="gap-6">
        <View className="gap-2">
          <Text className="text-title-md text-label-1">¿Cancelar reserva?</Text>
          <Text className="text-body text-label-3">
            {lastResourceName
              ? `${lastResourceName}${lastScheduleLabel ? ` · ${lastScheduleLabel}` : ""}. `
              : ""}
            Tendrás 5 segundos para deshacerlo después de confirmar.
          </Text>
        </View>
        <View className="gap-2">
          <Button variant="gray-destructive" loading={confirming} onPress={onConfirm}>
            Cancelar reserva
          </Button>
          <Button variant="plain" onPress={onClose}>
            Volver
          </Button>
        </View>
      </View>
    </Sheet>
  );
}
