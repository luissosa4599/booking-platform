import type { ExpoConfig } from "expo/config";

// Plain CommonJS (see the file itself for why) — imported without types.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const withAndroidNightBackground = require("./plugins/withAndroidNightBackground");

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
  // This top-level field is iOS's only option (baked at build time, ONE
  // value) — light `canvas` (global.css `--color-canvas`). Android gets a
  // real dark variant via `withAndroidNightBackground` in the `plugins`
  // array below (2026-09-17) — see "Safe area + theme-flash" in the root
  // CLAUDE.md for the full 5-layer contract this closes the last gap in.
  // Per-client theming never touches this: the swappable tokens are only
  // `tint*`, and `canvas`/`card` flip on light/dark alone.
  backgroundColor: "#F7F7F8",
  ios: {
    // Must match the "iOS" OAuth client's bundle id in Google Cloud Console —
    // expo-auth-session derives the native redirect scheme from it.
    bundleIdentifier: "mx.tempo.app",
  },
  android: {
    backgroundColor: "#F7F7F8",
    adaptiveIcon: {
      // Solid brand terracotta, matching the real tempo-icon.svg background
      // (2026-09-18 — icon.png and both adaptive layers were regenerated
      // from that file; this was the one hardcoded copy of its old color).
      // The foreground mark is kept inside the 66dp / 61% safe zone.
      backgroundColor: "#B8481D",
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
    // Pins Android build-tools to what's actually installed on this dev
    // machine's shared SDK (C:\Program Files (x86)\Android\android-sdk,
    // installed by Visual Studio for a separate project) — the RN/Expo
    // gradle template defaults to build-tools 35.0.0, which isn't present,
    // and `sdkmanager` can't auto-install it into Program Files (x86)
    // without admin elevation. 36.0.0 is already there (2026-09-17, first
    // `expo run:android` attempt on the local emulator).
    [
      "expo-build-properties",
      {
        android: { buildToolsVersion: "36.0.0" },
      },
    ],
    [
      "expo-splash-screen",
      {
        // Brand wash / ink — no *visible* image on purpose. The mark
        // *assembles* in `components/AnimatedSplash.tsx` (the handoff's
        // "ensamble seco"), so the native splash is just the ground colour
        // that covers the pre-JS gap; a static mark here would double-draw
        // and fight the animation.
        //
        // `image` still has to point at *something* — found the hard way via
        // a real `eas build` failure: on Android 12+, this plugin always
        // wires `windowSplashScreenAnimatedIcon` to `@drawable/splashscreen_logo`
        // (that's how the OS's own SplashScreen API works, not something this
        // config can turn off), but only generates that drawable when `image`
        // is set — omitting it left a style referencing a drawable that was
        // never created, so `processReleaseResources` failed to link
        // ("resource drawable/splashscreen_logo ... not found"). A 1x1 fully
        // transparent PNG satisfies the resource requirement while staying
        // invisible, same as having no icon at all.
        image: "./assets/images/splash-icon-transparent.png",
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
    // Native Google Sign-In (Android/iOS) — lib/auth/google.native.ts.
    // expo-auth-session's browser-redirect flow (lib/auth/google.ts, web-only
    // now) can't be used on native: Google deprecated custom-URI-scheme
    // redirects for Android/iOS OAuth client types (2026-09-14, real "Error
    // 400: invalid_request" hit on the first Android build). This SDK talks
    // to Google Play Services / the native iOS SDK directly instead.
    [
      "@react-native-google-signin/google-signin",
      {
        // iOS only — the reversed "iOS" OAuth client id, used as the redirect
        // URL scheme. Not used on Android (Play Services verifies the app via
        // its package name + SHA-1, already registered as the "Android"
        // OAuth client in Google Cloud Console — see the Google Cloud gotcha
        // further down).
        iosUrlScheme: "com.googleusercontent.apps.308532152683-ffkj7gca9gkj8i516dijvoj4bsohbqs9",
      },
    ],
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
    // Native date/time pickers for the host's weekly-schedule + ad-hoc-slot
    // editors. Ships in Expo Go; the plugin only matters for a real build.
    "@react-native-community/datetimepicker",
    // QR scanner on the host "Escanear" tab. The permission string only lands
    // in a real build — Expo Go shows its own.
    [
      "expo-camera",
      {
        cameraPermission:
          "Tempo usa la cámara solo para leer el QR de las reservaciones. Nada se guarda.",
      },
    ],
    // Foreground ("cuando la app está en uso") location — orders Explore by
    // proximity and centres the owner map picker. Only the plugin permission
    // string is build-time; the request itself works in Expo Go and on web.
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "Tempo usa tu ubicación para ordenar los espacios por cercanía.",
      },
    ],
    // Photo library access for the host to add photos of their space. Build-only
    // permission string; library picking works in Expo Go and on web.
    [
      "expo-image-picker",
      {
        photosPermission:
          "Tempo accede a tus fotos para que publiques imágenes de tu espacio.",
      },
    ],
    // Native Explore map (SpaceMap.native.tsx, 2026-09-17) — Google Maps SDK
    // for Android. `androidGoogleMapsApiKey` is the exact key this plugin
    // reads (confirmed in its own source, `plugin/build/android.js`) to wire
    // into AndroidManifest.xml's `com.google.android.geo.API_KEY` meta-data —
    // it is NOT read at JS runtime the way `GOOGLE_MAPS_STATIC_KEY` is.
    // Restrict this key to the Android app (package `mx.tempo.app` above +
    // the build's keystore SHA-1), never referrer-restrict it like the web
    // static-maps key — Android app restriction checks the cert, not an
    // HTTP referrer. No iOS build exists yet (see CLAUDE.md), so no iOS key.
    [
      "react-native-maps",
      {
        androidGoogleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY,
      },
    ],
    // Android dark cold-start fix (2026-09-17) — see the plugin file itself
    // and the `backgroundColor` comment above for the full story. Same dark
    // value as expo-splash-screen's own `dark.backgroundColor` just below.
    [withAndroidNightBackground, { color: "#17110D" }],
  ],
  experiments: {
    reactCompiler: false,
  },
  extra: {
    eas: {
      // From `eas init` (2026-09-11, @luissosa4599/tempo:
      // https://expo.dev/accounts/luissosa4599/projects/tempo). Not a
      // secret — it's a public app identifier, same as any other Expo
      // project id — so it's fine to commit directly rather than route it
      // through EXPO_PUBLIC_EAS_PROJECT_ID: `eas-cli` itself doesn't load
      // `.env` the way `expo start`/Metro does, and dynamic app.config.ts
      // can't be auto-patched by `eas init` the way app.json can.
      // lib/notifications.ts reads this to get an Expo push token.
      projectId:
        process.env.EXPO_PUBLIC_EAS_PROJECT_ID ??
        "d6605661-65b8-4772-9593-9cb4de23e3c4",
    },
  },
};

export default config;
