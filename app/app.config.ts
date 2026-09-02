import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "Tempo",
  slug: "tempo",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "app",
  userInterfaceStyle: "automatic",
  // Native window background — the colour the OS paints *before* JS mounts
  // (cold start) and, on the native stack, briefly behind a scene mid-push.
  // This is baked at build time, so it can only be ONE value; we use the
  // LIGHT `canvas` (global.css `--color-canvas`). See "Safe area + theme-flash"
  // in the root CLAUDE.md — a `values-night` config plugin is the follow-up
  // for a dark-mode cold-start with zero flash. Per-client theming never
  // touches this: the swappable tokens are only `tint*`, and `canvas`/`card`
  // flip on light/dark alone.
  backgroundColor: "#F7F7F8",
  ios: {
    // Must match the "iOS" OAuth client's bundle id in Google Cloud Console —
    // expo-auth-session derives the native redirect scheme from it.
    bundleIdentifier: "mx.tempo.app",
  },
  android: {
    backgroundColor: "#F7F7F8",
    adaptiveIcon: {
      // Solid brand terracotta — the handoff's adaptive spec ("Fondo del
      // adaptive: color sólido #C2571F, sin degradado"). The foreground mark
      // is kept inside the 66dp / 61% safe zone.
      backgroundColor: "#C2571F",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
    // Must match the "Android" OAuth client's package name in Google Cloud Console.
    package: "mx.tempo.app",
  },
  web: {
    output: "static",
    favicon: "./assets/images/favicon.png",
    bundler: "metro",
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        // Brand wash / ink — no image on purpose. The mark *assembles* in
        // `components/AnimatedSplash.tsx` (the handoff's "ensamble seco"), so
        // the native splash is just the ground colour that covers the pre-JS
        // gap; a static mark here would double-draw and fight the animation.
        backgroundColor: "#FBEFE8",
        dark: { backgroundColor: "#17110D" },
      },
    ],
    // Push notifications (booking reminders, waitlist openings — both sent
    // server-side by the notification worker, see CLAUDE.md). Default
    // config — no custom notification icon/sound asset in this project.
    "expo-notifications",
    // Persists the signed-in user id on native (web falls back to localStorage
    // in lib/session.ts).
    "expo-secure-store",
    // "Añadir al calendario" on the ConfirmedScreen. Without the plugin the
    // native calendar-permission string is missing / defaults to English even
    // on a Spanish device. NOTE: config-plugin permission strings only take
    // effect in a real dev-build / production build — in Expo Go the dialog
    // is whatever Expo Go itself ships.
    [
      "expo-calendar",
      {
        calendarPermission:
          "Tempo necesita acceso a tu calendario para agregar tus reservas.",
      },
    ],
  ],
  experiments: {
    reactCompiler: false,
  },
  extra: {
    eas: {
      // Set once `eas init` has run — lib/notifications.ts reads this to get
      // an Expo push token; until then, push registration silently no-ops.
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
    },
  },
};

export default config;
