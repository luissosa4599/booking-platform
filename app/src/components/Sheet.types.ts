import type { ReactNode } from "react";

export interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Web-only (the native sheet is always full-width, bottom-anchored) — caps
   * the centered dialog's width in px instead of the default `max-w-md`
   * (448px). Ignored by `Sheet.native.tsx`. */
  maxWidth?: number;
}

// Scrim behind the sheet on every platform. Colour is the `scrim` design
// token (`useColor("scrim")` on native, `bg-scrim/70` on web) — a neutral
// dark grey, not pure black. Opacity is animated with the sheet on native,
// so it's a separate constant there.
export const SHEET_OVERLAY_OPACITY = 0.7;
