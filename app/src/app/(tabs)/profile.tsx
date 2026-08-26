import { Text, View } from "react-native";

import { ScreenFade } from "@/components/ScreenFade";
import { User } from "@/lib/icons";

// The handoff names this tab ("Tú") as one of the 3 required by the TabBar
// spec but never designs its content — no SignInScreen-adjacent profile
// screen exists in this handoff at all. Honest placeholder rather than
// invented content: enough to make the tab a real destination, nothing more.
export default function ProfileScreen() {
  return (
    <ScreenFade>
      <View className="flex-1 items-center justify-center gap-4 bg-canvas px-10">
        <View className="h-16 w-16 items-center justify-center rounded-[18px] bg-fill text-chevron">
          <User size={26} />
        </View>
        <Text className="text-title-sm text-center text-label-1">
          Próximamente
        </Text>
        <Text className="text-body text-center text-label-3">
          Tu perfil y ajustes van a vivir aquí — no está diseñado todavía.
        </Text>
      </View>
    </ScreenFade>
  );
}
