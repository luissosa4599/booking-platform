import type { ComponentType } from "react";
import type { BottomTabBarProps } from "expo-router/tabs";
import { BlurView } from "expo-blur";
import { useColorScheme } from "nativewind";
import { Pressable, Text, View } from "react-native";

import { cn } from "@/lib/cn";
import { Compass, type IconProps } from "@/lib/icons";
import { useColor } from "@/lib/theme/useColor";

export interface TabConfig {
  icon: ComponentType<IconProps>;
  accessibilityLabel: string;
}

// Custom renderer instead of the built-in tabBar*Color/Style options: those take
// literal color strings, not classNames, which would mean hardcoding `tint` (a
// runtime theme value) here. Rendered by hand + shared between the guest and
// host tab groups so the CLAUDE.md gotchas (bg-glass not bg-card/92, BlurView
// ignores className, every icon needs an explicit color) only live in one place.
//
// Must be rendered as a real element (`<CustomTabBar {...props} tabs={TABS} />`),
// not called as a function — it uses hooks.
type CustomTabBarProps = BottomTabBarProps & { tabs: Record<string, TabConfig> };

export function CustomTabBar({
  state,
  descriptors,
  navigation,
  insets,
  tabs,
}: CustomTabBarProps) {
  const { colorScheme } = useColorScheme();
  const activeColor = useColor("tint");
  const inactiveColor = useColor("label-4");

  return (
    <View className="bg-canvas">
      <View
        style={{ paddingBottom: insets.bottom }}
        className="mx-auto w-full max-w-[420px] border-t border-hairline"
      >
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
        <View
          className="absolute inset-0 bg-glass"
          style={{ pointerEvents: "none" }}
        />
        <View className="h-[82px] flex-row px-[30px] pt-3">
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const label =
              typeof options.title === "string" ? options.title : route.name;
            const isFocused = state.index === index;
            const config = tabs[route.name];
            const Icon = config?.icon ?? Compass;

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
                accessibilityLabel={config?.accessibilityLabel ?? label}
                accessibilityState={isFocused ? { selected: true } : {}}
                className="flex-1 items-center gap-1"
              >
                <View className={isFocused ? "text-tint" : "text-label-4"}>
                  <Icon
                    size={22}
                    color={isFocused ? activeColor : inactiveColor}
                  />
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
