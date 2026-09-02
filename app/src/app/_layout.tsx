import { useEffect, useState, type ReactNode } from "react";
import { LogBox, View } from "react-native";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
  useFonts,
} from "@expo-google-fonts/space-grotesk";
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider as NavThemeProvider,
  useRouter,
  useSegments,
} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "nativewind";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AnimatedSplash } from "@/components/AnimatedSplash";
import { Toast } from "@/components/Toast";
import { queryClient } from "@/lib/api/queryClient";
import { useAuthStore } from "@/lib/session";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { useColor } from "@/lib/theme/useColor";
import { useToastStore } from "@/lib/toastStore";

import "@/global.css";

// The native splash (image-less — just the brand colour) stays up until
// `AnimatedSplash` mounts and calls `hideAsync`, so there's no gap before the
// "ensamble" plays.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Dev-tooling noise, not app bugs: the HMR client warns loudly when it can't
// reach Metro (common when testing on a phone over LAN/VPN — the app itself
// still works, Fast Refresh just doesn't).
LogBox.ignoreLogs(["Cannot connect to Expo CLI", /Cannot connect to Metro/]);

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
  // MUST stay reactive via `useColor` (not a literal): on a light/dark switch
  // this re-renders in the same frame as every `Screen`, so no layer is ever
  // a stale colour mid-transition. See CLAUDE.md "Safe area + theme-flash".
  const canvas = useColor("canvas");
  const card = useColor("card");

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

  const { colorScheme } = useColorScheme();
  // The React Navigation container paints its own background behind every
  // scene and during transitions. Its default is a hardcoded light grey
  // (`rgb(242,242,242)`) in BOTH schemes — that's the "pantallazo blanco" on a
  // resource → back → tabs transition, especially in dark mode. Point it at
  // the app's `canvas` (reactive), same as the Stack `contentStyle`.
  const navBase = colorScheme === "dark" ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...navBase,
    colors: { ...navBase.colors, background: canvas, card },
  };

  // Nothing to paint until we know whether there's a session — avoids a flash
  // of Explore before the redirect to /sign-in.
  if (!hydrated) {
    return <View className="flex-1 bg-canvas" />;
  }

  return (
    <NavThemeProvider value={navTheme}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: canvas },
        }}
      />
    </NavThemeProvider>
  );
}

// The booking-success toast (lib/toastStore) is rendered here, above the
// navigator, not inside a screen — so it survives every navigation AND can sit
// at the true bottom of the screen instead of being lifted to clear the
// TabBar (a tabbed screen's own toast, e.g. Reservas' undo, still passes
// `raised`). See CLAUDE.md "Toast lives at the root".
function GlobalToast() {
  const router = useRouter();
  const message = useToastStore((s) => s.message);
  const actionLabel = useToastStore((s) => s.actionLabel);
  const clear = useToastStore((s) => s.clear);

  return (
    <Toast
      isOpen={!!message}
      message={message ?? ""}
      actionLabel={actionLabel}
      onAction={() => {
        clear();
        router.navigate("/bookings");
      }}
      onDismiss={clear}
    />
  );
}

// A persistent opaque `canvas` layer behind the whole app — the last line of
// defence against a white flash (cold start, an unpainted frame mid-nav). In
// Expo Go this is also the only theme-aware ground colour: `app.config.ts`'s
// native `backgroundColor` only takes effect in a real build.
function AppBackground({ children }: { children: ReactNode }) {
  const canvas = useColor("canvas");
  return <View style={{ flex: 1, backgroundColor: canvas }}>{children}</View>;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
  });
  const hydrated = useAuthStore((s) => s.hydrated);
  const [splashDone, setSplashDone] = useState(false);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppBackground>
          <QueryClientProvider client={queryClient}>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <StatusBar style="auto" />
              <AuthGate />
              <GlobalToast />
              {!splashDone ? (
                <AnimatedSplash
                  appReady={fontsLoaded && hydrated}
                  onFinish={() => setSplashDone(true)}
                />
              ) : null}
            </GestureHandlerRootView>
          </QueryClientProvider>
        </AppBackground>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
