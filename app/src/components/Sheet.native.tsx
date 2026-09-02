import BottomSheet, {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { useCallback, useEffect, useRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColor } from "@/lib/theme/useColor";
import type { SheetProps } from "./Sheet.types";
import {
  SHEET_OVERLAY_COLOR_HEX,
  SHEET_OVERLAY_OPACITY,
} from "./Sheet.types";

export function Sheet({ isOpen, onClose, children }: SheetProps) {
  const sheetRef = useRef<BottomSheet>(null);
  const insets = useSafeAreaInsets();
  // `card` and `chevron` ARE theme tokens (near-black card + a lighter grabber
  // in dark mode) — the sheet was hardcoded to white, which showed as a white
  // slab behind the UI on a dark device.
  const cardColor = useColor("card");
  const grabberColor = useColor("chevron");

  useEffect(() => {
    if (isOpen) {
      sheetRef.current?.expand();
    } else {
      sheetRef.current?.close();
    }
  }, [isOpen]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
        opacity={SHEET_OVERLAY_OPACITY}
        style={[props.style, { backgroundColor: SHEET_OVERLAY_COLOR_HEX }]}
      />
    ),
    [],
  );

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      // No fixed snap point — size to the content. A hardcoded "50%" cut off
      // taller content (the 409 "alternatives" list) and left dead white space
      // for shorter content.
      enableDynamicSizing
      enablePanDownToClose
      onClose={onClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={{
        backgroundColor: cardColor,
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
      }}
      handleIndicatorStyle={{
        backgroundColor: grabberColor,
        width: 40,
        height: 5,
      }}
    >
      <BottomSheetView
        className="gap-[22px] px-5 pt-[10px]"
        style={{ paddingBottom: Math.max(insets.bottom, 16) + 18 }}
      >
        {children}
      </BottomSheetView>
    </BottomSheet>
  );
}
