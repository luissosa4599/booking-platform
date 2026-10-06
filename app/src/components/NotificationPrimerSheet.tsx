import { Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Sheet } from "@/components/Sheet";
import { Bell } from "@/lib/icons";
import { useNotificationPrimerStore } from "@/lib/notificationPrimer";
import { registerForPushNotificationsAsync } from "@/lib/notifications";
import { useColor } from "@/lib/theme/useColor";

/**
 * Root-mounted. Explains why Tempo wants notifications *before* the OS dialog
 * appears — offered once after a first booking to anyone who skipped the
 * tutorial's permissions step (see lib/notificationPrimer.ts).
 */
export function NotificationPrimerSheet() {
  const isOpen = useNotificationPrimerStore((s) => s.isOpen);
  const dismiss = useNotificationPrimerStore((s) => s.dismiss);
  // useColor + inline style — tint classNames don't reach a Sheet's portal on web.
  const washColor = useColor("tint-wash");
  const iconColor = useColor("tint-press");

  return (
    <Sheet isOpen={isOpen} onClose={dismiss}>
      <View className="gap-5">
        <View className="items-center gap-3">
          <View
            className="h-12 w-12 items-center justify-center rounded-full"
            style={{ backgroundColor: washColor }}
          >
            <Bell size={22} color={iconColor} />
          </View>
          <Text className="text-center text-title-sm text-label-1">
            ¿Te avisamos 30 minutos antes?
          </Text>
          <Text className="text-center text-body text-label-3">
            Usamos las notificaciones solo para recordarte tus reservas y
            avisarte si se libera un lugar en tu lista de espera. Nada de
            publicidad.
          </Text>
        </View>
        <View className="gap-2">
          <Button
            variant="filled"
            onPress={() => {
              dismiss();
              void registerForPushNotificationsAsync({ prompt: true });
            }}
          >
            Activar avisos
          </Button>
          <Button variant="plain" onPress={dismiss}>
            Ahora no
          </Button>
        </View>
      </View>
    </Sheet>
  );
}
