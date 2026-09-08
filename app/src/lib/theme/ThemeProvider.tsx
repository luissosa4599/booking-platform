import {
  colorScheme as nativewindColorScheme,
  useColorScheme,
  vars,
} from "nativewind";
import { useEffect, type ReactNode } from "react";
import { Platform, View } from "react-native";

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
 * Mounts the theme's CSS variables for everything below it in the tree.
 * Follows the OS light/dark setting automatically (`useColorScheme()`'s
 * default mode is "system" — no manual toggle built yet, matching what was
 * asked for: automatic, not a user-facing control). A future client-theme
 * selector only needs to change which pair of `vars()` objects this picks
 * between.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === "dark" ? appleThemeDark : appleTheme;

  // Web-only: NativeWind's automatic system-scheme tracking is backed by
  // React Native Web's `Appearance.getColorScheme()`, which doesn't actually
  // react to the OS preference on web the way it does natively — confirmed
  // empirically (Playwright's `prefers-color-scheme: dark` emulation left
  // `colorScheme` at "light"). So on web this reads `matchMedia` directly
  // and pushes it into NativeWind itself via `colorScheme.set(...)`.
  //
  // That still only fixes the 4 *themeable* tokens above (mounted via
  // `vars()`, which react to `colorScheme` on any platform). The *static*
  // tokens in src/global.css are a different mechanism — plain CSS behind a
  // `.dark:root` selector — which on web needs an actual `dark` class on the
  // real document root; nothing else adds it. So this same effect also
  // toggles that class. Native doesn't have a DOM, and doesn't need this at
  // all: NativeWind resolves `:root`/`.dark:root` there by reading
  // `colorScheme` directly (and that part of the pipeline does track the
  // system there), no class to toggle.
  useEffect(() => {
    if (Platform.OS !== "web") {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = (isDark: boolean) => {
      nativewindColorScheme.set(isDark ? "dark" : "light");
      document.documentElement.classList.toggle("dark", isDark);
    };

    apply(media.matches);
    const listener = (e: MediaQueryListEvent) => apply(e.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  return <View style={[{ flex: 1 }, theme]}>{children}</View>;
}
