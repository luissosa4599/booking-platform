/**
 * Tokens sourced from docs/design-handoff.md ("Design Tokens" section).
 * All colors below are plain CSS-variable references
 * (`rgb(var(--color-x) / <alpha-value>)`), but the variables themselves
 * come from two different places depending on the token:
 *
 * - tint / tint-press / tint-soft / tint-wash — the 4 "themeable" tokens.
 *   Their CSS variables are supplied at runtime by ThemeProvider
 *   (src/lib/theme/ThemeProvider.tsx) via NativeWind's vars(), not by any
 *   stylesheet. This is prep for per-client theming — only one theme
 *   (`appleTheme`) is ever mounted today.
 * - everything else (labels, canvas/card/fill/hairline/chevron/
 *   disabled-label, state-*) — fixed, defined in src/global.css's `:root`
 *   / `.dark:root` and must never move into ThemeProvider.
 *
 * Class names (`bg-card`, `text-tint`, ...) don't change based on where a
 * given token's variable comes from — screens never condition on it either.
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Themeable — variables come from ThemeProvider, not global.css.
        tint: "rgb(var(--color-tint) / <alpha-value>)",
        "tint-press": "rgb(var(--color-tint-press) / <alpha-value>)",
        "tint-soft": "rgb(var(--color-tint-soft) / <alpha-value>)",
        "tint-wash": "rgb(var(--color-tint-wash) / <alpha-value>)",

        // Static — variables come from global.css, never themeable.
        "label-1": "rgb(var(--color-label-1) / <alpha-value>)",
        "label-2": "rgb(var(--color-label-2) / <alpha-value>)",
        "label-3": "rgb(var(--color-label-3) / <alpha-value>)",
        "label-4": "rgb(var(--color-label-4) / <alpha-value>)",

        card: "rgb(var(--color-card) / <alpha-value>)",
        canvas: "rgb(var(--color-canvas) / <alpha-value>)",
        fill: "rgb(var(--color-fill) / <alpha-value>)",
        hairline: "rgb(var(--color-hairline) / <alpha-value>)",
        chevron: "rgb(var(--color-chevron) / <alpha-value>)",
        "disabled-label": "rgb(var(--color-disabled-label) / <alpha-value>)",

        "state-free": "rgb(var(--color-state-free) / <alpha-value>)",
        "state-last": "rgb(var(--color-state-last) / <alpha-value>)",
        "state-error": "rgb(var(--color-state-error) / <alpha-value>)",
        "state-waiting": "rgb(var(--color-state-waiting) / <alpha-value>)",
      },

      // Size / line-height / tracking / weight per the handoff's "Tipografía"
      // table. Tailwind's fontSize plugin always prefixes with `text-`, so
      // these are used as `text-title-lg`, `text-body-emph`, etc. — never
      // bare. Where the handoff lists a dual weight ("footnote", 400/600),
      // the 600 case is applied by composing `font-semibold` on top — it's
      // a contextual override (group headers, button subtitle), not a
      // separate named size.
      fontSize: {
        "title-lg": [
          "34px",
          { lineHeight: "40px", letterSpacing: "-0.03em", fontWeight: "700" },
        ],
        "title-md": [
          "28px",
          { lineHeight: "34px", letterSpacing: "-0.025em", fontWeight: "700" },
        ],
        "title-sm": [
          "22px",
          { lineHeight: "28px", letterSpacing: "-0.02em", fontWeight: "600" },
        ],
        "body-emph": [
          "17px",
          { lineHeight: "22px", letterSpacing: "-0.01em", fontWeight: "600" },
        ],
        body: [
          "17px",
          { lineHeight: "22px", letterSpacing: "-0.01em", fontWeight: "400" },
        ],
        subhead: [
          "15px",
          { lineHeight: "20px", letterSpacing: "-0.01em", fontWeight: "400" },
        ],
        footnote: [
          "13px",
          { lineHeight: "18px", letterSpacing: "0em", fontWeight: "400" },
        ],
      },

      // Multiples of 4. These match Tailwind's default spacing scale at
      // these keys already — declared explicitly per the handoff's "prohibido
      // cualquier valor fuera de esta escala" rule, so the scale is
      // documented here rather than implied by Tailwind's defaults.
      spacing: {
        1: "4px",
        2: "8px",
        3: "12px",
        4: "16px",
        5: "20px",
        6: "24px",
        8: "32px",
        10: "40px",
      },

      borderRadius: {
        // The handoff gives "control" as an 8-10px range that varies by
        // component rather than a single value: stepper's inner +/- buttons
        // use 8, the segmented control's active pill uses 7, its container
        // uses 9, and the search field / stepper container use 10. `control`
        // aliases the most common case (search field, stepper container);
        // the others are named after the component that uses them.
        control: "10px",
        "control-segmented": "9px",
        "control-segmented-inner": "7px",
        "control-inner": "8px",

        button: "14px",
        group: "22px",
        sheet: "30px",
        logo: "16px",
        full: "9999px",
      },
    },
  },
  plugins: [],
};
