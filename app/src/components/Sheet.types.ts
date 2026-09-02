import type { ReactNode } from "react";

export interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

// Design handoff: overlay behind the sheet on every platform, rgba(11,11,12,0.38).
// Split into color + opacity for native, where BottomSheetBackdrop animates
// opacity separately from the backdrop's base colour. The sheet surface and
// grabber colours are theme tokens, resolved with `useColor` in Sheet.native.
export const SHEET_OVERLAY_COLOR_HEX = "#0B0B0C";
export const SHEET_OVERLAY_OPACITY = 0.38;
