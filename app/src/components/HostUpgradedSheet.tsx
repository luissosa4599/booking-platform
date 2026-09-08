import { Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Sheet } from "@/components/Sheet";
import { SuccessCheckmark } from "@/components/SuccessCheckmark";

interface HostUpgradedSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** "Ir a Mis espacios" — swaps the nav root to the host group. */
  onGoToSpaces: () => void;
}

// Handoff B2 — shown over BecomeHostScreen right after the upgrade succeeds.
export function HostUpgradedSheet({
  isOpen,
  onClose,
  onGoToSpaces,
}: HostUpgradedSheetProps) {
  return (
    <Sheet isOpen={isOpen} onClose={onClose}>
      <View className="items-center gap-5">
        {/* SuccessCheckmark keys its entrance animation off mount — only
            render it while the sheet is open so it plays each time. */}
        {isOpen ? <SuccessCheckmark /> : <View className="h-[104px]" />}
        <View className="items-center gap-2">
          <Text className="text-title-md text-center text-label-1">
            Ya eres anfitrión
          </Text>
          <Text className="text-body text-center text-label-3">
            Publica tu primer espacio para empezar a recibir reservas.
          </Text>
        </View>
        <View className="w-full gap-3">
          <Button variant="filled" onPress={onGoToSpaces}>
            Ir a Mis espacios
          </Button>
          <Button variant="plain" onPress={onClose}>
            Después
          </Button>
        </View>
      </View>
    </Sheet>
  );
}
