import { useEffect } from "react";
import { View } from "react-native";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { queryClient } from "@/lib/api/queryClient";
import { useAuthStore } from "@/lib/session";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";

import "@/global.css";

// Routes reachable without a session.
const PUBLIC_SEGMENTS = new Set(["sign-in", "auth"]);

function AuthGate() {
  const router = useRouter();
  const segments = useSegments();
  const hydrated = useAuthStore((s) => s.hydrated);
  const session = useAuthStore((s) => s.session);
  const hydrate = useAuthStore((s) => s.hydrate);

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

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <AuthGate />
        </GestureHandlerRootView>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
