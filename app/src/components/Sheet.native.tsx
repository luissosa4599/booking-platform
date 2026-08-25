import BottomSheet, {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { useCallback, useEffect, useMemo, useRef } from "react";

import type { SheetProps } from "./Sheet.types";
import { SHEET_OVERLAY_COLOR_HEX, SHEET_OVERLAY_OPACITY } from "./Sheet.types";

export function Sheet({ isOpen, onClose, children }: SheetProps) {
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ["50%"], []);

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
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onClose}
      backdropComponent={renderBackdrop}
    >
      <BottomSheetView className="p-6">{children}</BottomSheetView>
    </BottomSheet>
  );
}
