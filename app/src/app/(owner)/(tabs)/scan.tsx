import { Text, View } from "react-native";

import { Screen } from "@/components/Screen";
import { Camera } from "@/lib/icons";
import { useColor } from "@/lib/theme/useColor";

// Stub — the real camera scanner lands in PR C (needs expo-camera).
export default function ScanScreen() {
  const iconColor = useColor("chevron");
  return (
    <Screen bg="canvas">
      <View className="flex-1 items-center justify-center gap-4 px-10">
        <View className="h-16 w-16 items-center justify-center rounded-[18px] bg-fill">
          <Camera size={26} color={iconColor} />
        </View>
        <Text className="text-title-sm text-center text-label-1">Próximamente</Text>
        <Text className="text-body text-center text-label-3">
          Aquí vas a escanear el QR de cada reserva para confirmar la visita.
        </Text>
      </View>
    </Screen>
  );
}
