import { useState } from "react";
import { Animated as RNAnimated, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const HERO_HEIGHT = 196;
const HERO_EXPANDED_MAX = 460;

/**
 * The collapsing-hero maths shared by the guest `resource/[id]` and host
 * `(owner)/space/[id]` detail screens. Legacy `Animated` + `useNativeDriver:
 * false` — it animates `height`, a layout prop, and it's the API that actually
 * works cross-platform here (see CLAUDE.md).
 *
 * Usage: wrap the photo carousel in `<RNAnimated.View style={{ height:
 * heroHeight }}>`, give the scroll view `onScroll={onScroll}` +
 * `contentContainerStyle={{ minHeight: contentMinHeight }}`.
 */
export function useCollapsingHero() {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  const heroExpanded = Math.round(
    Math.min(windowHeight * 0.5, HERO_EXPANDED_MAX),
  );
  const heroCollapsed = HERO_HEIGHT + insets.top;
  const collapseDistance = Math.max(1, heroExpanded - heroCollapsed);

  const [scrollY] = useState(() => new RNAnimated.Value(0));
  const heroHeight = scrollY.interpolate({
    inputRange: [0, collapseDistance],
    outputRange: [heroExpanded, heroCollapsed],
    extrapolate: "clamp",
  });

  const onScroll = RNAnimated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: false },
  );

  // The hero is in-flow, so its shrinking would otherwise shrink the scrollable
  // content and, on a short page, feed back into the scroll offset (a shudder).
  // Guaranteeing the content is always >= `collapseDistance` taller than the
  // viewport means the hero height is already clamped by the time you can reach
  // the bottom. (The classic parallax-ScrollView "footer spacer" trick.)
  const contentMinHeight = windowHeight + collapseDistance;

  return { insets, heroExpanded, heroHeight, onScroll, contentMinHeight };
}
