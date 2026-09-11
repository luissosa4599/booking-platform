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
