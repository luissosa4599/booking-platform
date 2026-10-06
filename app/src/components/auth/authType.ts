import type { TextStyle } from "react-native";

/**
 * Sign-in redesign handoff §3 — the type scale for the auth screens (sign-in,
 * forgot/reset password). Inline styles, not NativeWind `text-*` classes:
 * these sizes/line-heights aren't on the app's own scale, and arbitrary-value
 * classNames have silently generated no CSS here before (CLAUDE.md).
 * UI text is the system font; Space Grotesk is brand-only (titles).
 */
export const authType = {
  display: { fontFamily: "SpaceGrotesk_700Bold", fontSize: 34, lineHeight: 40, letterSpacing: -0.6 },
  displayWeb: { fontFamily: "SpaceGrotesk_700Bold", fontSize: 56, lineHeight: 60, letterSpacing: -1 },
  statWeb: { fontFamily: "SpaceGrotesk_700Bold", fontSize: 64, lineHeight: 64, letterSpacing: -1 },
  title: { fontFamily: "SpaceGrotesk_700Bold", fontSize: 28, lineHeight: 34, letterSpacing: -0.4 },
  barTitle: { fontSize: 17, lineHeight: 24, fontWeight: "600" },
  body: { fontSize: 16, lineHeight: 24 },
  bodyWeb: { fontSize: 18, lineHeight: 28 },
  button: { fontSize: 16, lineHeight: 24, fontWeight: "700" },
  button2: { fontSize: 16, lineHeight: 24, fontWeight: "600" },
  emailCard: { fontSize: 16, lineHeight: 24, fontWeight: "600" },
  action: { fontSize: 15, lineHeight: 20, fontWeight: "600" },
  label: { fontSize: 14, lineHeight: 20, fontWeight: "600" },
  inline: { fontSize: 14, lineHeight: 20 },
  help: { fontSize: 13, lineHeight: 18 },
} satisfies Record<string, TextStyle>;

/** Handoff §5 — every control on these screens is 52 tall with a 14 radius. */
export const CONTROL_HEIGHT = 52;
export const CONTROL_RADIUS = 14;
