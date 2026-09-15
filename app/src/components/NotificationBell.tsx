import { Pressable, Text, View } from "react-native";

import { Bell } from "@/lib/icons";
import { useColor } from "@/lib/theme/useColor";

interface NotificationBellProps {
  unreadCount: number;
  onPress: () => void;
}

// `bg-state-error` is a static token (not one of the 6 themeable ones), so
// it's safe as a plain className here even though this sits right next to
// components that had to work around the Sheet-portal gotcha — this bell
// itself is never rendered inside a Sheet.
export function NotificationBell({ unreadCount, onPress }: NotificationBellProps) {
  const iconColor = useColor("label-1");

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        unreadCount > 0 ? `Notificaciones, ${unreadCount} sin leer` : "Notificaciones"
      }
      style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}
    >
      <Bell size={20} strokeWidth={2} color={iconColor} />
      {unreadCount > 0 ? (
        <View
          className="bg-state-error"
          style={{
            position: "absolute",
            top: -2,
            right: -2,
            minWidth: 16,
            height: 16,
            borderRadius: 8,
            paddingHorizontal: 3,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "700" }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
