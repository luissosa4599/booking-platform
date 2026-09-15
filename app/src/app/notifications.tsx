import { useEffect } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { Screen } from "@/components/Screen";
import { useMarkNotificationsRead, useNotifications, type AppNotification } from "@/lib/api/notifications";
import { ArrowLeft, Ban, CalendarClock, Clock } from "@/lib/icons";
import { notificationCopy } from "@/lib/notificationCopy";
import { useColor } from "@/lib/theme/useColor";

function relativeLabel(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "hace 1 día" : `hace ${days} días`;
}

function iconForType(type: AppNotification["type"]) {
  switch (type) {
    case "waitlist_slot_opened":
      return CalendarClock;
    case "booking_cancelled_by_host":
      return Ban;
    case "reminder":
    default:
      return Clock;
  }
}

// Full screen, not a sheet (2026-09-15 report: "estilo instagram... te lleva
// a una pagina de pantalla completa"). `_layout.tsx` gives this route an
// explicit `slide_from_right` animation (Android-only in practice — iOS's
// native-stack already slides by default, Web ignores the option).
export default function NotificationsScreen() {
  const router = useRouter();
  const backColor = useColor("label-1");
  const iconColor = useColor("label-3");
  const { notifications } = useNotifications();
  const { markRead } = useMarkNotificationsRead();

  // Marks everything read as soon as the screen is seen — same "opening it
  // counts as seen" contract the sheet version had, just moved to a real
  // screen instead of a modal open.
  useEffect(() => {
    void markRead();
  }, [markRead]);

  return (
    <Screen bg="canvas" edges={["top", "bottom"]}>
      <View className="flex-row items-center gap-3 px-4 py-2">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          className="h-9 w-9 items-center justify-center rounded-full bg-fill"
        >
          <ArrowLeft size={18} color={backColor} />
        </Pressable>
        <Text className="text-body-emph text-label-1">Notificaciones</Text>
      </View>

      {notifications.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-body text-label-3">Todavía no tienes notificaciones.</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8 }}
          renderItem={({ item }) => {
            const Icon = iconForType(item.type);
            return (
              <View className="flex-row items-start gap-3 border-b border-hairline-inset py-3">
                <View className="h-9 w-9 items-center justify-center rounded-full bg-fill">
                  <Icon size={18} color={iconColor} />
                </View>
                <View className="flex-1 gap-1">
                  <Text className="text-body text-label-1">{notificationCopy(item)}</Text>
                  <Text className="text-footnote text-label-3">{relativeLabel(item.sentAt)}</Text>
                </View>
              </View>
            );
          }}
        />
      )}
    </Screen>
  );
}
