import { Animated, Modal, Pressable, View } from "react-native";

import { useFadeTransition } from "@/lib/useFadeTransition";

import type { SheetProps } from "./Sheet.types";

const TRANSITION_MS = 200;

// @gorhom/bottom-sheet's web support is unreliable (see README's
// "Cross-platform notes"), so web gets a plain centered modal instead. Full
// rounded-sheet corners (not rounded-t-only) since a centered card isn't
// bottom-anchored the way the native sheet is — no grabber either, a
// centered dialog isn't swipe-to-dismiss.
//
// `Modal`'s `animationType` prop is a documented no-op on react-native-web.
// The fade/scale here uses legacy `Animated` (from 'react-native', not
// Reanimated) driven straight through `useFadeTransition` — see that file
// for why: Reanimated's web backend and Tailwind's `transition-*` utilities
// both turned out not to work for this, independently, in this project.
export function Sheet({ isOpen, onClose, children }: SheetProps) {
  const { mounted, opacity } = useFadeTransition(isOpen, TRANSITION_MS);

  if (!mounted) {
    return null;
  }

  const scale = opacity.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] });

  return (
    <Modal visible transparent onRequestClose={onClose}>
      <Animated.View style={{ opacity, flex: 1 }}>
        <Pressable
          className="flex-1 items-center justify-center bg-[rgba(11,11,12,0.38)]"
          onPress={onClose}
        >
          <Animated.View style={{ transform: [{ scale }] }} className="w-full max-w-md">
            <Pressable
              className="gap-[22px] rounded-sheet bg-card px-5 py-6"
              onPress={(e) => e.stopPropagation()}
            >
              <View>{children}</View>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}
