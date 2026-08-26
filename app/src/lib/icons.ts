import type { ComponentType } from "react";
import { Check as LucideCheck } from "lucide-react-native";

export {
  ArrowLeft,
  Calendar,
  CalendarX,
  ChevronRight,
  Compass,
  Minus,
  Plus,
  Search,
  User,
} from "lucide-react-native";

// `strokeWidth` is a real, supported SVG attribute lucide forwards at
// runtime, but it's missing from this version's exported `LucideProps`
// type — cast just this one icon rather than every call site that needs a
// bolder stroke.
export const Check = LucideCheck as ComponentType<{
  size?: number;
  strokeWidth?: number;
}>;

// Handoff: "usar el set de iconos del proyecto — expo-symbols (SF Symbols)
// en iOS con fallback a lucide-react-native." Using lucide-react-native
// uniformly across iOS/Android/Web instead of branching per platform — one
// consistent icon language everywhere, matching the rest of this app's
// single-codebase approach (see CLAUDE.md's cross-platform notes).
//
// No `className` support on these — `cssInterop`'s `nativeStyleToProp`
// (the documented way to give a non-View/Text component className support)
// didn't actually forward color on web: every icon rendered black
// regardless of the class passed, confirmed via getComputedStyle. Lucide
// sets `stroke="currentColor"` on its SVG paths, so color instead comes
// from ordinary CSS inheritance — put the `text-*` class on the
// View/Pressable/Text that already wraps the icon (never on the icon
// itself), and `currentColor` resolves correctly with zero extra plumbing.
// This also means these keep working through a real theme switch (`tint`
// is a runtime CSS var, not a static class) without needing cssInterop to
// understand that at all.
