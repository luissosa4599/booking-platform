import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "app",
  slug: "app",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "app",
  userInterfaceStyle: "automatic",
  ios: {
    icon: "./assets/expo.icon",
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
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
    // 30-minutes-before reminder for a confirmed booking (ConfirmedScreen).
    // Default config — no custom notification icon/sound asset in this project.
    "expo-notifications",
    // Persists the signed-in user id on native (web falls back to localStorage
    // in lib/session.ts).
    "expo-secure-store",
  ],
  experiments: {
    reactCompiler: false,
  },
};

export default config;
