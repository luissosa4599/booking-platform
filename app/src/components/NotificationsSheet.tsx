import { ScrollView, Text, View } from "react-native";

import { Sheet } from "@/components/Sheet";
import type { AppNotification } from "@/lib/api/notifications";
import { notificationCopy } from "@/lib/notificationCopy";

interface NotificationsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
}

function relativeLabel(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "hace 1 día" : `hace ${days} días`;
}

// A plain scan-and-close list, no per-row actions — read state is handled
// for the whole batch (see useMarkNotificationsRead) when this sheet opens,
// not per row. Only static tokens (label-*) here, safe inside a Sheet
// without the useColor/inline-style workaround `Button`/`NextBookingBanner`
// needed for the 6 themeable tint tokens.
export function NotificationsSheet({ isOpen, onClose, notifications }: NotificationsSheetProps) {
  return (
    <Sheet isOpen={isOpen} onClose={onClose}>
      <View style={{ gap: 20 }}>
        <Text className="text-title-sm text-label-1">Notificaciones</Text>

        {notifications.length === 0 ? (
          <Text className="text-body text-label-3">Todavía no tienes notificaciones.</Text>
        ) : (
          <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: 16 }}>
            {notifications.map((n) => (
              <View key={n.id} className="gap-1">
                <Text className="text-body text-label-1">{notificationCopy(n)}</Text>
                <Text className="text-footnote text-label-3">{relativeLabel(n.sentAt)}</Text>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </Sheet>
  );
}
