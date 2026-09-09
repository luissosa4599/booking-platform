import { Text, View } from "react-native";

import { Map } from "@/lib/icons";
import { useColor } from "@/lib/theme/useColor";
import type { SpaceMapProps } from "./SpaceMap.types";

/**
 * Native placeholder for the Explore map (PR #10). The interactive map is
 * web-only for now — a native build with `react-native-maps` is the follow-up
 * (needs EAS; see the roadmap). On phone the Lista/Mapa toggle isn't shown, so
 * this only renders if something forces `view === "map"` on native.
 */
export function SpaceMap(_props: SpaceMapProps) {
  const icon = useColor("label-4");
  return (
    <View className="flex-1 items-center justify-center gap-3 bg-canvas px-10">
      <Map size={28} color={icon} />
      <Text className="text-center text-body text-label-3">
        El mapa está disponible en la versión web por ahora.
      </Text>
    </View>
  );
}
