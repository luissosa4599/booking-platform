const { AndroidConfig, withAndroidColorsNight } = require("expo/config-plugins");

/**
 * First custom config plugin in this repo (2026-09-17) — closes the last gap
 * in the theme-flash contract documented in `app.config.ts` / the root
 * CLAUDE.md ("Safe area + theme-flash"): the native window background
 * (`android.backgroundColor`, layer 1 of that contract) is baked at build
 * time as a single value, so a dark-mode user saw a brief light flash on
 * Android cold start before any JS/React layer painted over it.
 *
 * Plain CommonJS, not TypeScript, on purpose — `app.config.ts` itself gets
 * transpiled by Expo's config loader, but a *local* module it imports does
 * not (confirmed the hard way: importing a `.ts` plugin file threw `Cannot
 * find module './plugins/withAndroidNightBackground'` — Node's CJS resolver
 * never looks for a `.ts` extension on a relative `require`). Plain `.js`
 * needs no transpilation, so it just works.
 *
 * Confirmed via a throwaway `expo prebuild` (2026-09-17, output discarded,
 * not committed — this is a managed project, no `android/` checked in):
 * `android:windowBackground` in `values/styles.xml`'s `AppTheme` points at
 * `@color/activityBackground`, defined in `values/colors.xml` from
 * `app.config.ts`'s `android.backgroundColor`. `expo-splash-screen`'s own
 * plugin already writes a `values-night/colors.xml` (for its own
 * `splashscreen_background`, from `expo-splash-screen`'s `dark.backgroundColor`)
 * but never touches `activityBackground` — this plugin adds that one
 * missing key to the same night resource file, using the same
 * `AndroidConfig.Colors.assignColorValue` helper Expo's own plugins use
 * internally, so it merges into (never replaces) whatever else has already
 * written to `values-night/colors.xml`.
 *
 * @param {import("expo/config-plugins").ExpoConfig} config
 * @param {{ color: string }} props
 */
function withAndroidNightBackground(config, { color }) {
  return withAndroidColorsNight(config, (config) => {
    config.modResults = AndroidConfig.Colors.assignColorValue(config.modResults, {
      name: "activityBackground",
      value: color,
    });
    return config;
  });
}

module.exports = withAndroidNightBackground;
