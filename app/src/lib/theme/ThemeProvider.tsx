import {
  colorScheme as nativewindColorScheme,
  useColorScheme,
  vars,
} from "nativewind";
import { useEffect, type ReactNode } from "react";
import { Platform, View } from "react-native";

import { useThemeStore } from "./themeStore";

/**
 * Only the 4 "themeable" tokens from docs/design-handoff.md live here —
 * everything else (labels, canvas/card/fill/hairline, state colors,
 * typography, spacing, radii) is fixed and stays in tailwind.config.js.
 * This split is prep for per-client theming: today only `appleTheme` is
 * ever mounted (see ThemeProvider below), but swapping in a different
 * client's theme later means passing a different `vars()` object here —
 * no component changes, no retrabajo.
 *
 * Values are space-separated RGB triplets, matching the `rgb(var(--color-x)
 * / <alpha-value>)` format tailwind.config.js uses for these same 4 colors.
 */
export const appleTheme = vars({
  "--color-tint": "194 87 31" /* #C2571F */,
  "--color-tint-press": "160 69 26" /* #A0451A */,
  "--color-tint-soft": "232 168 131" /* #E8A883 */,
  "--color-tint-wash": "251 239 232" /* #FBEFE8 */,
  /* Text/icon color that sits on top of a `tint` fill (filled button label,
     success checkmark). Paired with `tint`, so it lives here and flips with
     the theme — white on the dark-orange light accent, near-black on the
     lightened dark accent (handoff § "tema oscuro": "texto sobre él es
     #40200B"). Without this the filled CTA is white-on-#E8A883 in dark mode. */
  "--color-on-tint": "255 255 255" /* #FFFFFF */,
  /* Subtitle text inside a filled (tint-background) button — handoff "Color —
     themeable" table. Paired with tint, flips with the theme like on-tint. */
  "--color-on-tint-sub": "246 217 199" /* #F6D9C7 */,
});

/**
 * Dark variant of the themeable tokens. Values are the host handoff's
 * "Color — themeable" table, dark column (hifi/final): tint-press/tint-soft
 * shift to #C2571F, tint-wash to #40200B (previously these kept their light
 * values — an earlier under-spec, corrected here).
 */
export const appleThemeDark = vars({
  "--color-tint": "232 168 131" /* #E8A883 */,
  "--color-tint-press": "194 87 31" /* #C2571F — handoff host "Color — themeable" dark col */,
  "--color-tint-soft": "194 87 31" /* #C2571F */,
  "--color-tint-wash": "64 32 11" /* #40200B */,
  "--color-on-tint": "64 32 11" /* #40200B — handoff § "tema oscuro" */,
  "--color-on-tint-sub": "110 58 23" /* #6E3A17 */,
});

interface ThemeProviderProps {
  children: ReactNode;
}

/**
 * Mounts the theme's CSS variables for everything below it in the tree, and
 * drives light/dark from the user's preference (`themeStore`): "system" follows
 * the OS, "light"/"dark" are explicit overrides set from the profile's AJUSTES
 * switch. A future client-theme selector only changes which pair of `vars()`
 * objects this picks between.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  const { colorScheme } = useColorScheme();
  const preference = useThemeStore((s) => s.preference);
  const hydrateThemePreference = useThemeStore((s) => s.hydrate);
  const theme = colorScheme === "dark" ? appleThemeDark : appleTheme;

  useEffect(() => {
    void hydrateThemePreference();
  }, [hydrateThemePreference]);

  // Two mechanisms have to agree:
  //  - the 4 themeable tokens (mounted via `vars()`) react to NativeWind's
  //    `colorScheme`, so we push the resolved scheme into it;
  //  - the static tokens in src/global.css sit behind a `.dark:root` selector,
  //    which on web needs a real `dark` class on the document root (nothing
  //    else adds it). Native has no DOM and resolves `:root`/`.dark:root` from
  //    `colorScheme` directly, so there the class toggle is a no-op guard.
  //
  // Web also can't rely on NativeWind's own system tracking (RN-Web's
  // `Appearance` doesn't follow `prefers-color-scheme` live — verified with
  // Playwright), so for "system" we listen to `matchMedia` ourselves.
  useEffect(() => {
    const applyClass = (isDark: boolean) => {
      if (Platform.OS === "web") {
        document.documentElement.classList.toggle("dark", isDark);
      }
    };

    if (preference !== "system") {
      nativewindColorScheme.set(preference);
      applyClass(preference === "dark");
      return;
    }

    // "system"
    if (Platform.OS !== "web") {
      nativewindColorScheme.set("system");
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = (isDark: boolean) => {
      nativewindColorScheme.set(isDark ? "dark" : "light");
      applyClass(isDark);
    };
    apply(media.matches);
    const listener = (e: MediaQueryListEvent) => apply(e.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [preference]);

  return <View style={[{ flex: 1 }, theme]}>{children}</View>;
}
