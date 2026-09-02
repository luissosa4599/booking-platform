import type { ReactNode } from "react";

export interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

// Scrim behind the sheet on every platform. Colour is the `scrim` design
// token (`useColor("scrim")` on native, `bg-scrim/70` on web) — a neutral
// dark grey, not pure black. Opacity is animated with the sheet on native,
// so it's a separate constant there.
export const SHEET_OVERLAY_OPACITY = 0.7;
