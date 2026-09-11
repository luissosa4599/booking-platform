import { Platform, Pressable } from "react-native";

import { haptics } from "@/lib/haptics";
import { RotateCw } from "@/lib/icons";
import { useColor } from "@/lib/theme/useColor";

/**
 * Web-only manual refresh affordance. `RefreshControl`'s pull-to-refresh drag
 * gesture is a no-op on react-native-web — there's no native scroll physics
 * to hook the pull into, so dragging down on a mobile browser does nothing.
 * Native keeps the real pull gesture (this renders `null` there); web gets an
 * explicit tap target instead, next to whatever "updated"/"refreshing" label
 * the screen already shows.
 */
export function RefreshButton({
  onPress,
  refreshing,
}: {
  onPress: () => void;
  refreshing: boolean;
}) {
  const color = useColor("label-3");

  if (Platform.OS !== "web") return null;

  return (
    <Pressable
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      disabled={refreshing}
      accessibilityRole="button"
      accessibilityLabel="Actualizar"
      className="h-7 w-7 items-center justify-center rounded-full"
      style={{ opacity: refreshing ? 0.4 : 1 }}
    >
      <RotateCw size={15} color={color} />
    </Pressable>
  );
}
