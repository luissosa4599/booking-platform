/**
 * JS mirror of the color tokens (src/global.css `:root` / `.dark:root` + the
 * themeable ones from ThemeProvider). Needed because `lucide-react-native`
 * icons render `stroke="currentColor"`, and on **native** that does not
 * inherit from a parent `<View>`'s color the way it does on web — so an icon's
 * color has to be passed as an explicit `color` prop, which means resolving
 * the token to a value in JS. Keep in sync with global.css / ThemeProvider.
 */
const LIGHT = {
  "label-1": "#0B0B0C",
  "label-2": "#3C3C43",
  "label-3": "#6C6C70",
  "label-4": "#8A8A8E",
  card: "#FFFFFF",
  canvas: "#F7F7F8",
  fill: "#EFEFF2",
  hairline: "#E5E5EA",
  chevron: "#C7C7CC",
  "disabled-label": "#B9B9BE",
  "state-free": "#2C9160",
  "state-last": "#C08A18",
  "state-error": "#C0392B",
  "state-waiting": "#3A76C4",
  tint: "#C2571F",
  "tint-press": "#A0451A",
  "tint-soft": "#E8A883",
  "tint-wash": "#FBEFE8",
  "on-tint": "#FFFFFF",
  scrim: "#1C1C1E",
} as const;

const DARK: Record<keyof typeof LIGHT, string> = {
  ...LIGHT,
  canvas: "#000000",
  card: "#1C1C1E",
  fill: "#2C2C2E",
  hairline: "#38383A",
  "label-1": "#FFFFFF",
  "label-2": "#AEAEB2",
  "label-3": "#8A8A8E",
  chevron: "#48484A",
  "state-free": "#30B565",
  "state-last": "#D9A93F",
  "state-error": "#E0524A",
  "state-waiting": "#5A96E0",
  tint: "#E8A883",
  "on-tint": "#40200B",
};

export type ColorToken = keyof typeof LIGHT;

export function palette(scheme: "light" | "dark"): Record<ColorToken, string> {
  return scheme === "dark" ? DARK : LIGHT;
}
