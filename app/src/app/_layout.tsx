import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, LogBox, StyleSheet, View } from "react-native";
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
import { useReduceMotion } from "@/lib/useReduceMotion";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { useThemeStore } from "@/lib/theme/themeStore";
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
// A signed-in host may sit here without being bounced into their own nav group
// (the become-host success sheet lives on this screen).
const ROLE_NEUTRAL_SEGMENTS = new Set(["become-host"]);

function AuthGate() {
  const router = useRouter();
  const segments = useSegments();
  const hydrated = useAuthStore((s) => s.hydrated);
  const session = useAuthStore((s) => s.session);
  const viewMode = useAuthStore((s) => s.viewMode);
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

  // Never issue the same redirect twice in a row — a belt-and-braces guard
  // against a redirect loop if a target ever fails to change `segments`.
  const lastRedirect = useRef<string | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    const seg0 = segments[0] ?? "";
    const onPublic = PUBLIC_SEGMENTS.has(seg0);
    const inOwner = seg0 === "(owner)";
    const hostView = session?.role === "host" && viewMode === "host";

    // Host home = "/spaces" (owner group), guest home = "/". These are distinct
    // URLs — an earlier version pointed both at "/", which is ambiguous from
    // inside (owner) and froze the app on a mode switch.
    let target: "/sign-in" | "/spaces" | "/" | null = null;
    if (!session && !onPublic) {
      target = "/sign-in";
    } else if (session && onPublic) {
      target = hostView ? "/spaces" : "/";
    } else if (session && !ROLE_NEUTRAL_SEGMENTS.has(seg0)) {
      if (hostView && !inOwner) target = "/spaces";
      else if (!hostView && inOwner) target = "/";
    }

    if (!target) {
      lastRedirect.current = null;
      return;
    }
    if (lastRedirect.current === target + seg0) return;
    lastRedirect.current = target + seg0;
    router.replace(target);
  }, [hydrated, session, viewMode, segments, router]);

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

// Handoff: switching between the guest and host nav groups is a 240ms cross-fade,
// not a hard cut. `Stack`'s own `animation` option is Android-only (CLAUDE.md),
// so this does it by hand: a canvas-coloured layer flashes opaque over the swap
// (in 100ms, out 140ms) whenever the route crosses into or out of `(owner)` —
// covers the "Modo anfitrión" toggle and become-host -> "Ir a Mis espacios".
function GroupTransition() {
  const inOwner = (useSegments()[0] ?? "") === "(owner)";
  const canvas = useColor("canvas");
  const reduceMotion = useReduceMotion();
  const [cover] = useState(() => new Animated.Value(0));
  const settled = useRef<boolean | null>(null);

  useEffect(() => {
    if (settled.current === null) {
      settled.current = inOwner;
      return;
    }
    if (settled.current === inOwner) return;
    settled.current = inOwner;
    if (reduceMotion) return;

    cover.setValue(0);
    Animated.sequence([
      Animated.timing(cover, {
        toValue: 1,
        duration: 100,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(cover, {
        toValue: 0,
        duration: 140,
        delay: 20,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, [inOwner, cover, reduceMotion]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: canvas, opacity: cover, zIndex: 40 },
      ]}
    />
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
  });
  const hydrated = useAuthStore((s) => s.hydrated);
  const themeHydrated = useThemeStore((s) => s.hydrated);
  const [splashDone, setSplashDone] = useState(false);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppBackground>
          <QueryClientProvider client={queryClient}>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <StatusBar style="auto" />
              <AuthGate />
              <GroupTransition />
              <GlobalToast />
              {!splashDone ? (
                <AnimatedSplash
                  appReady={fontsLoaded && hydrated && themeHydrated}
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
