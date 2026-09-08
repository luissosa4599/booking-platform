import type { ComponentType } from "react";
import {
  ArrowLeft as LArrowLeft,
  Ban as LBan,
  Calendar as LCalendar,
  CalendarClock as LCalendarClock,
  CalendarX as LCalendarX,
  Camera as LCamera,
  Check as LCheck,
  ChevronRight as LChevronRight,
  Clock as LClock,
  Compass as LCompass,
  Heart as LHeart,
  LogOut as LLogOut,
  MapPin as LMapPin,
  Minus as LMinus,
  Plus as LPlus,
  QrCode as LQrCode,
  Search as LSearch,
  Store as LStore,
  Trash2 as LTrash2,
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
  /** Fill color — used for the filled/active state of an outline icon (e.g. a
   * favorited Heart). lucide forwards it to the underlying `<svg>`. */
  fill?: string;
}

const typed = <T,>(icon: T) => icon as ComponentType<IconProps>;

export const ArrowLeft = typed(LArrowLeft);
export const Ban = typed(LBan);
export const Calendar = typed(LCalendar);
export const CalendarClock = typed(LCalendarClock);
export const CalendarX = typed(LCalendarX);
export const Camera = typed(LCamera);
export const Check = typed(LCheck);
export const ChevronRight = typed(LChevronRight);
export const Clock = typed(LClock);
export const Compass = typed(LCompass);
export const Heart = typed(LHeart);
export const LogOut = typed(LLogOut);
export const MapPin = typed(LMapPin);
export const Minus = typed(LMinus);
export const Plus = typed(LPlus);
export const QrCode = typed(LQrCode);
export const Search = typed(LSearch);
export const Store = typed(LStore);
export const Trash2 = typed(LTrash2);
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
