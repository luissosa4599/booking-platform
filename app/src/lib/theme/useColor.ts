import { useColorScheme } from "nativewind";

import { palette, type ColorToken } from "./palette";

/**
 * Resolves a color token to a value for the current scheme. Use this for
 * `lucide-react-native` icons — pass the result as `color={...}` rather than
 * relying on a `text-*` class on a wrapper (which only cascades on web; see
 * palette.ts). Static UI colors should keep using NativeWind classes.
 */
export function useColor(token: ColorToken): string {
  const { colorScheme } = useColorScheme();
  return palette(colorScheme === "dark" ? "dark" : "light")[token];
}

/** The effective scheme after the user's theme preference is applied. */
export function useIsDark(): boolean {
  const { colorScheme } = useColorScheme();
  return colorScheme === "dark";
}
