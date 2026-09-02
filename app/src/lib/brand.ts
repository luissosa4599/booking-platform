// Fixed brand palette for the app icon + splash — from the "Tempo — icono de
// app y splash" handoff. **Not** the themeable `tint*` tokens: those swap per
// client, and the mark must look identical in every theme. Never use
// `bg-tint` / `text-tint` for brand surfaces — hard-code these.
export const BRAND = {
  wash: "#FBEFE8",
  soft: "#E8A883",
  base: "#C2571F",
  press: "#A0451A",
  deep: "#6E2E11",
  ink: "#17110D",
} as const;

export const BRAND_TAGLINE = "Tu espacio, tu tiempo.";
