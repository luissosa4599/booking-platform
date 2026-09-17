import { Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Sheet } from "@/components/Sheet";

interface DisconnectCalendarSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  confirming?: boolean;
}

// Reservas/Tú handoff §3.5 point 2 — once Google Calendar is connected, the
// row stops being a direct "tap to toggle" target (per the handoff, it's
// non-tappable text + a state-free dot) and disconnecting now goes through
// this confirmation sheet instead, opened from a small trailing affordance
// on the row (see ProfileContent.tsx).
export function DisconnectCalendarSheet({
  isOpen,
  onClose,
  onConfirm,
  confirming = false,
}: DisconnectCalendarSheetProps) {
  return (
    <Sheet isOpen={isOpen} onClose={onClose}>
      <View className="gap-6">
        <View className="gap-2">
          <Text className="text-title-md text-label-1">¿Desconectar Google Calendar?</Text>
          <Text className="text-body text-label-3">
            Tus próximas reservas dejarán de agregarse automáticamente a tu calendario.
          </Text>
        </View>
        <View className="gap-2">
          <Button variant="gray-destructive" loading={confirming} onPress={onConfirm}>
            Desconectar
          </Button>
          <Button variant="plain" onPress={onClose}>
            Volver
          </Button>
        </View>
      </View>
    </Sheet>
  );
}
