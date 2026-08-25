import { vars } from "nativewind";
import type { ReactNode } from "react";
import { View } from "react-native";

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
 * in src/global.css. Not mounted yet — see ThemeProvider.
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
 * No selection logic yet — always `appleTheme`. A future client-theme
 * selector only needs to change which `vars()` object lands in this
 * `style` prop.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  return <View style={[{ flex: 1 }, appleTheme]}>{children}</View>;
}
