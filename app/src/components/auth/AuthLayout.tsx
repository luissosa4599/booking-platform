import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useQuery } from "@tanstack/react-query";

import { Screen } from "@/components/Screen";
import { apiFetch } from "@/lib/api/client";
import type { AvailabilitySlot } from "@/lib/api/types";
import { useColor } from "@/lib/theme/useColor";
import { BrandLogo } from "./AuthPieces";
import { authType } from "./authType";

/** Handoff J — from 1024px wide the brand panel sits left of a 400 column. */
export const AUTH_SPLIT_MIN = 1024;

export function useAuthSplit(): boolean {
  return useWindowDimensions().width >= AUTH_SPLIT_MIN;
}

/**
 * The shell every auth screen (sign-in, forgot/reset password) renders into.
 *
 * - Phone (and anything under 1024): one scrollable column, max 440 wide,
 *   24 gutters, `inset + 8` on top and `inset + 16` below (handoff §5). The
 *   screen decides what sits where inside it.
 * - Split (≥1024): the tint brand panel (560) on the left, the same content
 *   centred in a 400 column on the right. The panel never changes between
 *   steps (handoff J).
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  const split = useAuthSplit();

  if (split) {
    return (
      <Screen bg="canvas" edges={["top", "bottom"]} fluid>
        <View style={{ flex: 1, flexDirection: "row" }}>
          <BrandPanel />
          <ScrollView
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              flexGrow: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 48,
              paddingHorizontal: 24,
            }}
          >
            <View style={{ width: 400, maxWidth: "100%" }}>{children}</View>
          </ScrollView>
        </View>
      </Screen>
    );
  }

  return (
    <Screen bg="canvas" edges={["top", "bottom"]} fluid>
      <KeyboardAvoidingView
        // "height" (not "padding"/undefined) on Android — Expo SDK 57's
        // edge-to-edge default breaks the native adjustResize keyboard
        // behavior, so the keyboard covered the password field on a real
        // device without this (2026-09-14).
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            width: "100%",
            maxWidth: 440,
            alignSelf: "center",
            paddingHorizontal: 24,
            paddingTop: 8,
            paddingBottom: 16,
          }}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

// Public endpoint (no auth needed pre-login) — sums `capacityRemaining` for
// slots overlapping the next hour, same "ahora" window Explore itself uses.
function useFreeNowCount() {
  return useQuery({
    queryKey: ["sign-in", "free-now-count"],
    queryFn: async () => {
      const now = new Date();
      const to = new Date(now.getTime() + 60 * 60_000);
      const res = await apiFetch<{ slots: AvailabilitySlot[] }>(
        `/availability?${new URLSearchParams({
          from: now.toISOString(),
          to: to.toISOString(),
        }).toString()}`,
      );
      return res.slots.reduce((sum, slot) => sum + slot.capacityRemaining, 0);
    },
    staleTime: 60_000,
    retry: false,
  });
}

/**
 * Handoff J — the only live proof of value before asking for anything. The
 * stat row hides entirely while loading, on failure, and at 0 (never "0
 * lugares"). on-tint / on-tint-sub via `useColor`: `text-on-tint-sub` is a
 * 3-segment token className that generates no CSS here (CLAUDE.md).
 */
function BrandPanel() {
  const tint = useColor("tint");
  const onTint = useColor("on-tint");
  const onTintSub = useColor("on-tint-sub");
  const freeNow = useFreeNowCount();
  const count = freeNow.data ?? 0;

  return (
    <View
      style={{
        width: 560,
        backgroundColor: tint,
        padding: 56,
        justifyContent: "space-between",
      }}
    >
      <BrandLogo inverted />
      <View>
        <Text style={[authType.displayWeb, { color: onTint }]}>Aparta tu lugar.</Text>
        <Text style={[authType.bodyWeb, { color: onTintSub, marginTop: 16, maxWidth: 420 }]}>
          Salones, cubículos y salas de lectura de tu campus. Un tap y es tuyo.
        </Text>
        {count > 0 ? (
          <>
            <View style={{ height: 1, backgroundColor: onTintSub, marginTop: 48, marginBottom: 24 }} />
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 16 }}>
              <Text style={[authType.statWeb, { color: onTint, fontVariant: ["tabular-nums"] }]}>
                {count.toLocaleString("es-MX")}
              </Text>
              <Text style={{ fontSize: 18, lineHeight: 26, color: onTintSub, maxWidth: 220 }}>
                {count === 1
                  ? "lugar libre ahora mismo en tu campus"
                  : "lugares libres ahora mismo en tu campus"}
              </Text>
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
}
