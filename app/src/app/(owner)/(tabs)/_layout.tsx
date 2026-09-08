import { Tabs } from "expo-router/tabs";

import { CustomTabBar, type TabConfig } from "@/components/CustomTabBar";
import { Camera, Store, User } from "@/lib/icons";

const TABS: Record<string, TabConfig> = {
  index: { icon: Store, accessibilityLabel: "Tus espacios" },
  scan: { icon: Camera, accessibilityLabel: "Escanear un QR" },
  profile: { icon: User, accessibilityLabel: "Tu perfil" },
};

export default function OwnerTabsLayout() {
  return (
    <Tabs
      tabBar={(props) => CustomTabBar(props, TABS)}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: "Mis espacios" }} />
      <Tabs.Screen name="scan" options={{ title: "Escanear" }} />
      <Tabs.Screen name="profile" options={{ title: "Tú" }} />
    </Tabs>
  );
}
