import { Tabs } from "expo-router/tabs";

import { CustomTabBar, type TabConfig } from "@/components/CustomTabBar";
import { Calendar, Compass, User } from "@/lib/icons";

// Handoff § "TabBar": 3 tabs, no more, no fourth without a redesign.
const TABS: Record<string, TabConfig> = {
  index: { icon: Compass, accessibilityLabel: "Explorar espacios disponibles" },
  bookings: { icon: Calendar, accessibilityLabel: "Tus reservas" },
  profile: { icon: User, accessibilityLabel: "Tu perfil" },
};

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} tabs={TABS} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: "Explorar" }} />
      <Tabs.Screen name="bookings" options={{ title: "Reservas" }} />
      <Tabs.Screen name="profile" options={{ title: "Tú" }} />
    </Tabs>
  );
}
