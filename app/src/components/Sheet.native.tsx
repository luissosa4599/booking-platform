import BottomSheet, {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { useCallback, useEffect, useMemo, useRef } from "react";

import type { SheetProps } from "./Sheet.types";
import {
  SHEET_CARD_COLOR_HEX,
  SHEET_GRABBER_COLOR_HEX,
  SHEET_OVERLAY_COLOR_HEX,
  SHEET_OVERLAY_OPACITY,
} from "./Sheet.types";

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
      backgroundStyle={{
        backgroundColor: SHEET_CARD_COLOR_HEX,
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
      }}
      handleIndicatorStyle={{
        backgroundColor: SHEET_GRABBER_COLOR_HEX,
        width: 40,
        height: 5,
      }}
    >
      <BottomSheetView className="gap-[22px] px-5 pb-[34px] pt-[10px]">
        {children}
      </BottomSheetView>
    </BottomSheet>
  );
}
