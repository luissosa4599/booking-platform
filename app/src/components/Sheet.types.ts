import type { ReactNode } from "react";

export interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

// Design handoff: overlay behind the sheet on every platform, rgba(11,11,12,0.38).
// Split into color + opacity for native, where BottomSheetBackdrop animates
// opacity separately from the backdrop's base color.
export const SHEET_OVERLAY_COLOR = "rgba(11,11,12,0.38)";
export const SHEET_OVERLAY_COLOR_HEX = "#0B0B0C";
export const SHEET_OVERLAY_OPACITY = 0.38;

// `card`'s static (non-themeable) light value — @gorhom/bottom-sheet's
// backgroundStyle/handleIndicatorStyle need a real color, not a className, so
// this can't reference the CSS variable. Safe to hardcode: unlike tint/
// tint-press/tint-soft/tint-wash, `card` is never themeable.
export const SHEET_CARD_COLOR_HEX = "#FFFFFF";

// Grabber color — mentioned only in the handoff's Sheet component spec prose,
// not in the formal "Design Tokens" color tables, so it has no named token.
export const SHEET_GRABBER_COLOR_HEX = "#D6D6DB";
