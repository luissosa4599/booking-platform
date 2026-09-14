import { Animated, Modal, Pressable, View, type ViewStyle } from "react-native";

import { useColor } from "@/lib/theme/useColor";
import { useFadeTransition } from "@/lib/useFadeTransition";

import type { SheetProps } from "./Sheet.types";

// Was 200ms — bumped for perceptibility, 2026-09-11 punch-list item 4 (the
// user found the web app's transitions read as "fast-forward"). 300ms is the
// low end of the standard modal/panel-open band (general UX guidance:
// 300-500ms; Material Design 3's "transitions": 300-700ms). Web-only;
// Sheet.native.tsx's own TRANSITION_MS (240) is untouched — native has never
// been verified on a device, so there's nothing here to confirm the
// complaint applies to it too.
const TRANSITION_MS = 300;

// Web gets a plain centered modal (legacy `Animated` + RN `Modal`). The
// native sheet (Sheet.native.tsx) is a bottom-anchored slide-up built the
// same way — neither platform uses @gorhom/bottom-sheet anymore. Full
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
  // `useColor`, not the `bg-sheet` class — that class silently generated no
  // rule at all (confirmed via getComputedStyle: transparent background),
  // likely `sheet` colliding with the unrelated `rounded-sheet` radius key
  // in NativeWind's class generation. Same "className silently no-ops"
  // story as everywhere else in this project.
  const sheetColor = useColor("sheet");

  if (!mounted) {
    return null;
  }

  const scale = opacity.interpolate({
    inputRange: [0, 1],
    outputRange: [0.95, 1],
  });

  return (
    <Modal visible transparent onRequestClose={onClose}>
      <Animated.View style={{ opacity, flex: 1 }}>
        <Pressable
          className="flex-1 items-center justify-center bg-scrim/70"
          onPress={onClose}
        >
          <Animated.View
            style={{ transform: [{ scale }] }}
            className="w-full max-w-md"
          >
            {/* Capped height + internal scroll — without this, a sheet with
                tall content (many conflict alternatives, a big QR pass) filled
                the whole viewport: no backdrop strip was left to click for
                "close on outside tap", and the always-present 70%-opacity
                scrim had no visible pixels to show it either. Both looked
                broken for the same one reason. */}
            <Pressable
              className="gap-[22px] rounded-sheet px-5 py-6"
              // Inline, not `max-h-[85vh]`/`bg-sheet` classes — both silently
              // generated no rule at all on this project's NativeWind setup
              // (confirmed via getComputedStyle: max-height was "none", the
              // background was transparent) — `bg-sheet` most likely from
              // `sheet` colliding with the unrelated `rounded-sheet` radius
              // key. `DimensionValue` has no CSS-unit string case, so "85vh"
              // needs the cast — this file is web-only, no native code path
              // to break. "auto" (not "scroll") only shows the scrollbar when
              // content actually overflows the cap (2026-09-14 report — a
              // short sheet like SortControl's 4 options was always showing
              // OS scrollbar chrome for no reason with "scroll").
              style={
                {
                  maxHeight: "85vh",
                  overflow: "auto",
                  backgroundColor: sheetColor,
                } as unknown as ViewStyle
              }
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
