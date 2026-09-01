import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "Tempo",
  slug: "tempo",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "app",
  userInterfaceStyle: "automatic",
  ios: {
    icon: "./assets/expo.icon",
    // Must match the "iOS" OAuth client's bundle id in Google Cloud Console —
    // expo-auth-session derives the native redirect scheme from it.
    bundleIdentifier: "mx.tempo.app",
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
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
        backgroundColor: "#208AEF",
        image: "./assets/images/splash-icon.png",
        imageWidth: 76,
      },
    ],
    // Push notifications (booking reminders, waitlist openings — both sent
    // server-side by the notification worker, see CLAUDE.md). Default
    // config — no custom notification icon/sound asset in this project.
    "expo-notifications",
    // Persists the signed-in user id on native (web falls back to localStorage
    // in lib/session.ts).
    "expo-secure-store",
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
