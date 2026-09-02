import { useEffect } from "react";
import { LogBox, View } from "react-native";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { queryClient } from "@/lib/api/queryClient";
import { useAuthStore } from "@/lib/session";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { useColor } from "@/lib/theme/useColor";

import "@/global.css";

// Dev-tooling noise, not app bugs: the HMR client warns loudly when it can't
// reach Metro (common when testing on a phone over LAN/VPN — the app itself
// still works, Fast Refresh just doesn't).
LogBox.ignoreLogs([
  "Cannot connect to Expo CLI",
  /Cannot connect to Metro/,
]);

// Routes reachable without a session.
const PUBLIC_SEGMENTS = new Set(["sign-in", "auth"]);

function AuthGate() {
  const router = useRouter();
  const segments = useSegments();
  const hydrated = useAuthStore((s) => s.hydrated);
  const session = useAuthStore((s) => s.session);
  const hydrate = useAuthStore((s) => s.hydrate);
  // The native stack paints white behind a screen mid-transition unless the
  // scene has an explicit background — very visible on Android, especially
  // going resource/[id] → back → tabs. `canvas` is the app's ground colour
  // (near-black in dark mode), so the flash reads as "the app" not "a gap".
  const canvas = useColor("canvas");

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    const onPublic = PUBLIC_SEGMENTS.has(segments[0] ?? "");
    if (!session && !onPublic) {
      router.replace("/sign-in");
    } else if (session && onPublic) {
      router.replace("/");
    }
  }, [hydrated, session, segments, router]);

  // Nothing to paint until we know whether there's a session — avoids a flash
  // of Explore before the redirect to /sign-in.
  if (!hydrated) {
    return <View className="flex-1 bg-canvas" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: canvas },
      }}
    />
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <StatusBar style="auto" />
            <AuthGate />
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
