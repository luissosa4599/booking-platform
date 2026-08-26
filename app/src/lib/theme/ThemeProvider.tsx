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
});

/**
 * Dark variant of the same 4 tokens. The handoff's "tema oscuro" table only
 * redefines `tint` — tint-press/tint-soft/tint-wash keep their light values
 * (no documented dark override), same convention used for the static tokens
 * in src/global.css.
 */
export const appleThemeDark = vars({
  "--color-tint": "232 168 131" /* #E8A883 */,
  "--color-tint-press": "160 69 26" /* #A0451A */,
  "--color-tint-soft": "232 168 131" /* #E8A883 */,
  "--color-tint-wash": "251 239 232" /* #FBEFE8 */,
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
