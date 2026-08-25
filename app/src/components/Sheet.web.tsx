import { Modal, Pressable, View } from "react-native";

import type { SheetProps } from "./Sheet.types";

// @gorhom/bottom-sheet's web support is unreliable (see README's
// "Cross-platform notes"), so web gets a plain centered modal instead.
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
          className="w-full max-w-md rounded-2xl bg-white p-6"
          onPress={(e) => e.stopPropagation()}
        >
          <View>{children}</View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
