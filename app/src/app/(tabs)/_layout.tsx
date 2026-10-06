import { View } from "react-native";
import { Tabs } from "expo-router/tabs";

import { CustomTabBar, type TabConfig } from "@/components/CustomTabBar";
import { NavRail, type NavItem } from "@/components/NavRail";
import { RailModeSwitch } from "@/components/RailModeSwitch";
import { Calendar, Compass, User } from "@/lib/icons";
import { requireAccount } from "@/lib/requireAccount";

// Handoff § "TabBar": 3 tabs, no more, no fourth without a redesign.
const TABS: Record<string, TabConfig> = {
  index: { icon: Compass, accessibilityLabel: "Explorar espacios disponibles" },
  bookings: { icon: Calendar, accessibilityLabel: "Tus reservas" },
  profile: { icon: User, accessibilityLabel: "Tu perfil" },
};

// The same three destinations for the wide-viewport rail (PR #11).
const RAIL: NavItem[] = [
  { href: "/", label: "Explorar", icon: Compass, matchPrefixes: ["/resource"] },
  { href: "/bookings", label: "Reservas", icon: Calendar, requiresAccount: true },
  { href: "/profile", label: "Tú", icon: User, matchPrefixes: ["/become-host"] },
];

export default function TabsLayout() {
  return (
    <View style={{ flex: 1, flexDirection: "row" }}>
      <NavRail items={RAIL} footer={<RailModeSwitch />} />
      <View style={{ flex: 1 }}>
        <Tabs
          tabBar={(props) => <CustomTabBar {...props} tabs={TABS} />}
          screenOptions={{ headerShown: false }}
        >
          <Tabs.Screen name="index" options={{ title: "Explorar" }} />
          {/* Guest mode: Reservas needs an account — tapping it as a guest
              opens the sign-in modal instead of switching tabs. */}
          <Tabs.Screen
            name="bookings"
            options={{ title: "Reservas" }}
            listeners={{
              tabPress: (e) => {
                if (!requireAccount()) e.preventDefault();
              },
            }}
          />
          <Tabs.Screen name="profile" options={{ title: "Tú" }} />
        </Tabs>
      </View>
    </View>
  );
}
