import type { ComponentType, ReactNode } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { usePathname, useRouter } from "expo-router";

import { cn } from "@/lib/cn";
import type { IconProps } from "@/lib/icons";
import { useColor } from "@/lib/theme/useColor";
import { useBreakpoint } from "@/lib/useBreakpoint";

export interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<IconProps>;
  /** Paths (besides `href` itself) that should also light this item. */
  matchPrefixes?: string[];
}

/**
 * The wide-viewport navigation rail (PR #11) — replaces the bottom `CustomTabBar`
 * at `tablet`/`desktop`. Collapsed to icons at `tablet`, icon + label at
 * `desktop`. Web only: on native the TabBar always wins (native tablet is
 * code-review here — see CLAUDE.md). Rendered as a flex sibling of the tab
 * navigator in each `(tabs)/_layout`.
 */
export function NavRail({
  items,
  footer,
}: {
  items: NavItem[];
  footer?: ReactNode;
}) {
  const bp = useBreakpoint();
  const router = useRouter();
  const pathname = usePathname();
  const activeColor = useColor("tint-press");
  const idleColor = useColor("label-3");

  if (Platform.OS !== "web" || bp === "phone") {
    return null;
  }

  const expanded = bp === "desktop";

  return (
    <View
      className="border-r border-hairline bg-card"
      style={{
        width: expanded ? 220 : 72,
        alignSelf: "stretch",
        paddingTop: 20,
        paddingBottom: 16,
        paddingHorizontal: expanded ? 14 : 12,
      }}
    >
      <View
        className={cn(
          "flex-row items-center gap-2.5 pb-5",
          expanded ? "px-2" : "justify-center",
        )}
      >
        <BrandMark />
        {expanded ? (
          <Text
            className="text-label-1"
            style={{ fontFamily: "SpaceGrotesk_700Bold", fontSize: 18 }}
          >
            Tempo
          </Text>
        ) : null}
      </View>

      <View className="gap-1">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.matchPrefixes ?? []).some((p) => pathname.startsWith(p));
          const Icon = item.icon;
          return (
            <Pressable
              key={item.href}
              onPress={() => router.navigate(item.href)}
              accessibilityRole="link"
              accessibilityLabel={item.label}
              accessibilityState={active ? { selected: true } : {}}
              className={cn(
                "flex-row items-center rounded-[10px]",
                expanded ? "gap-3 px-2.5 py-2.5" : "justify-center py-3",
                active ? "bg-tint-wash" : "",
              )}
            >
              <Icon size={20} color={active ? activeColor : idleColor} />
              {expanded ? (
                <Text
                  className={cn(
                    "text-[15px]",
                    active
                      ? "font-semibold text-tint-press"
                      : "font-medium text-label-3",
                  )}
                >
                  {item.label}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <View className="flex-1" />
      {footer}
    </View>
  );
}

/** The three-block Tempo "T", small — echoes AnimatedSplash's geometry. */
function BrandMark() {
  return (
    <View
      className="rounded-[7px] bg-tint"
      style={{ width: 26, height: 26 }}
    >
      <View
        className="absolute rounded-[2px] bg-on-tint"
        style={{ left: 5, top: 5, width: 6, height: 16 }}
      />
      <View
        className="absolute rounded-[2px] bg-on-tint"
        style={{ left: 13, top: 5, width: 8, height: 6 }}
      />
      <View
        className="absolute rounded-[2px] bg-on-tint"
        style={{ left: 13, top: 13, width: 8, height: 8, opacity: 0.55 }}
      />
    </View>
  );
}
