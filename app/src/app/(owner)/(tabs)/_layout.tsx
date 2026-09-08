import { Tabs } from "expo-router/tabs";

import { CustomTabBar, type TabConfig } from "@/components/CustomTabBar";
import { Camera, Store, User } from "@/lib/icons";

// Distinct route names from the guest (tabs) group on purpose: two routes with
// the same URL path make router.replace("/") ambiguous and can freeze the app
// when switching nav groups. Here they're /spaces, /scan, /account.
const TABS: Record<string, TabConfig> = {
  spaces: { icon: Store, accessibilityLabel: "Tus espacios" },
  scan: { icon: Camera, accessibilityLabel: "Escanear un QR" },
  account: { icon: User, accessibilityLabel: "Tu perfil" },
};

export default function OwnerTabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} tabs={TABS} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="spaces" options={{ title: "Mis espacios" }} />
      <Tabs.Screen name="scan" options={{ title: "Escanear" }} />
      <Tabs.Screen name="account" options={{ title: "Tú" }} />
    </Tabs>
  );
}
