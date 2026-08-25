import { Modal, Pressable, View } from "react-native";

import type { SheetProps } from "./Sheet.types";

// @gorhom/bottom-sheet's web support is unreliable (see README's
// "Cross-platform notes"), so web gets a plain centered modal instead. Full
// rounded-sheet corners (not rounded-t-only) since a centered card isn't
// bottom-anchored the way the native sheet is — no grabber either, a
// centered dialog isn't swipe-to-dismiss.
export function Sheet({ isOpen, onClose, children }: SheetProps) {
  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 items-center justify-center bg-[rgba(11,11,12,0.38)]"
        onPress={onClose}
      >
        <Pressable
          className="w-full max-w-md gap-[22px] rounded-sheet bg-card px-5 py-6"
          onPress={(e) => e.stopPropagation()}
        >
          <View>{children}</View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
