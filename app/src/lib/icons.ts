import type { ComponentType } from "react";
import {
  ArrowLeft as LArrowLeft,
  Calendar as LCalendar,
  CalendarX as LCalendarX,
  Check as LCheck,
  ChevronRight as LChevronRight,
  Compass as LCompass,
  Minus as LMinus,
  Plus as LPlus,
  Search as LSearch,
  User as LUser,
  X as LX,
} from "lucide-react-native";

// `strokeWidth` and `color` are real, supported props lucide forwards at
// runtime, but this version's exported `LucideProps` type is narrow. One
// shared prop shape for every icon we use.
export interface IconProps {
  size?: number;
  strokeWidth?: number;
  /**
   * Explicit stroke color. **Always pass this** — lucide renders
   * `stroke="currentColor"`, which does NOT inherit from a parent View on
   * native (see lib/theme/palette.ts). Resolve it with `useColor()`.
   */
  color?: string;
}

const typed = <T,>(icon: T) => icon as ComponentType<IconProps>;

export const ArrowLeft = typed(LArrowLeft);
export const Calendar = typed(LCalendar);
export const CalendarX = typed(LCalendarX);
export const Check = typed(LCheck);
export const ChevronRight = typed(LChevronRight);
export const Compass = typed(LCompass);
export const Minus = typed(LMinus);
export const Plus = typed(LPlus);
export const Search = typed(LSearch);
export const User = typed(LUser);
export const X = typed(LX);

// Handoff: "usar el set de iconos del proyecto — expo-symbols (SF Symbols)
// en iOS con fallback a lucide-react-native." Using lucide-react-native
// uniformly across iOS/Android/Web instead of branching per platform — one
// consistent icon language everywhere, matching the rest of this app's
// single-codebase approach (see CLAUDE.md's cross-platform notes).
//
// Color: lucide sets `stroke="currentColor"`. On **web** that resolves via
// ordinary CSS inheritance from a wrapping View/Text/Pressable, so a `text-*`
// class on the wrapper works. On **native** it does NOT inherit — every icon
// must be given an explicit `color` prop (resolve the token with
// `useColor()` from lib/theme/useColor.ts). Passing `color` also works fine
// on web, so it's the cross-platform-safe way.
