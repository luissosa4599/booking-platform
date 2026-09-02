import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useFadeTransition } from "@/lib/useFadeTransition";
import { useColor } from "@/lib/theme/useColor";
import type { SheetProps } from "./Sheet.types";
import { SHEET_OVERLAY_OPACITY } from "./Sheet.types";

const TRANSITION_MS = 240;

// A bottom-anchored slide-up sheet on RN's `Modal` + the legacy `Animated`
// API (via useFadeTransition) — deliberately NOT @gorhom/bottom-sheet. That
// library (v5) + Reanimated 4 rendered this sheet permanently peeking a few px
// above the bottom edge, with a live backdrop that blocked every touch, on a
// real device. Same "legacy Animated is the one that actually works here"
// story as Sheet.web / Toast.web / ScreenFade.web — see CLAUDE.md.
//
// `useFadeTransition` keeps the Modal mounted through the close animation (so
// it slides out instead of vanishing) and unmounts it only once fully closed
// — which is also what guarantees the scrim can't eat a tap after "close".
//
// No swipe-down-to-dismiss yet (tap the scrim or a button in the sheet). The
// grabber is a visual affordance; wiring a real drag needs a gesture handler
// without tripping the react-hooks/refs lint — a later pass.
export function Sheet({ isOpen, onClose, children }: SheetProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const cardColor = useColor("card");
  const grabberColor = useColor("chevron");
  const scrimColor = useColor("scrim");

  const { mounted, opacity } = useFadeTransition(isOpen, TRANSITION_MS);

  if (!mounted) {
    return null;
  }

  // One 0→1 driver for both the slide and the scrim fade.
  const translateY = opacity.interpolate({
    inputRange: [0, 1],
    outputRange: [Math.round(windowHeight * 0.5), 0],
    extrapolate: "clamp",
  });
  const scrimOpacity = opacity.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SHEET_OVERLAY_OPACITY],
  });

  return (
    <Modal
      visible
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <Animated.View
          pointerEvents={isOpen ? "auto" : "none"}
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: scrimColor, opacity: scrimOpacity },
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityLabel="Cerrar"
          />
        </Animated.View>

        <Animated.View style={{ transform: [{ translateY }] }}>
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: cardColor,
                paddingBottom: Math.max(insets.bottom, 16) + 18,
              },
            ]}
          >
            <View style={[styles.grabber, { backgroundColor: grabberColor }]} />
            {children}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 22,
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: 2.5,
  },
});
