import type { ComponentType } from "react";
import { Tabs, type BottomTabBarProps } from "expo-router/tabs";
import { BlurView } from "expo-blur";
import { useColorScheme } from "nativewind";
import { Pressable, Text, View } from "react-native";

import { cn } from "@/lib/cn";
import { Calendar, Compass, User } from "@/lib/icons";

// Handoff § "TabBar": 3 tabs, no more, no fourth without a redesign.
const TAB_ICON: Record<string, ComponentType<{ size?: number }>> = {
  index: Compass,
  bookings: Calendar,
  profile: User,
};

const TAB_ACCESSIBILITY_LABEL: Record<string, string> = {
  index: "Explorar espacios disponibles",
  bookings: "Tus reservas",
  profile: "Tu perfil",
};

// Custom renderer instead of the built-in tabBar*Color/Style options: those
// take literal color strings, not classNames, which would mean hardcoding
// `tint` (a runtime theme value) here. Rendering the bar ourselves lets
// active/inactive state be plain `text-tint`/`text-label-4` classes, same
// pattern as everywhere else in this app — CSS inheritance colors the icon,
// per lib/icons.ts.
function CustomTabBar({
  state,
  descriptors,
  navigation,
  insets,
}: BottomTabBarProps) {
  const { colorScheme } = useColorScheme();

  return (
    // Full-width wrapper so the letterboxed gutters on wide web viewports read
    // as `canvas` (matching the screen) instead of React Navigation's light
    // default navigator background. The bar itself — border, blur, tint,
    // items — is constrained to the same 420px column ScreenFade gives every
    // screen and centered, so it doesn't stretch edge-to-edge.
    <View className="bg-canvas">
      <View
        style={{ paddingBottom: insets.bottom }}
        className="mx-auto w-full max-w-[420px] border-t border-hairline"
      >
        {/* BlurView ignores `className` entirely (no NativeWind interop for
            it, confirmed via getComputedStyle: no backdrop-filter, no
            background at all) — same category of gotcha as icons and legacy
            Animated.View elsewhere in this app. Blur goes on the BlurView via
            its own props; the bg-card/95 tint is a separate plain View on top
            of it, which NativeWind handles the normal way. */}
        <BlurView
          intensity={80}
          tint={colorScheme === "dark" ? "dark" : "light"}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: "none",
          }}
        />
        {/* `/92` is not on Tailwind's opacity scale, so NativeWind silently
            generated no rule for `bg-card/92` at all — the tint layer was
            fully transparent and the bar showed React Navigation's light
            default background through it (grey bar, even in dark mode). `/95`
            is a real scale step. */}
        <View
          className="absolute inset-0 bg-card/95"
          style={{ pointerEvents: "none" }}
        />
        <View className="h-[82px] flex-row px-[30px] pt-3">
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const label =
              typeof options.title === "string" ? options.title : route.name;
            const isFocused = state.index === index;
            const Icon = TAB_ICON[route.name] ?? Compass;

            const onPress = () => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                accessibilityRole="tab"
                accessibilityLabel={
                  TAB_ACCESSIBILITY_LABEL[route.name] ?? label
                }
                accessibilityState={isFocused ? { selected: true } : {}}
                className="flex-1 items-center gap-1"
              >
                <View className={isFocused ? "text-tint" : "text-label-4"}>
                  <Icon size={22} />
                </View>
                <Text
                  className={cn(
                    "text-[11px]",
                    isFocused
                      ? "font-semibold text-tint"
                      : "font-medium text-label-4",
                  )}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: "Explorar" }} />
      <Tabs.Screen name="bookings" options={{ title: "Reservas" }} />
      <Tabs.Screen name="profile" options={{ title: "Tú" }} />
    </Tabs>
  );
}
