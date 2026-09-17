import { useCallback, useState } from "react";
import {
  Animated as RNAnimated,
  useWindowDimensions,
  type LayoutChangeEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const HERO_HEIGHT = 196;
const HERO_EXPANDED_MAX = 460;

/**
 * The collapsing-hero maths for the guest `resource/[id]` detail screen.
 * Legacy `Animated` + `useNativeDriver: false` — it animates `height`, a
 * layout prop, and it's the API that actually works cross-platform here
 * (see CLAUDE.md).
 *
 * Usage: wrap the photo carousel in `<RNAnimated.View style={{ height:
 * heroHeight }}>`, give the scroll view `onScroll={onScroll}`, and put
 * `onLayout={onRestContentLayout}` on the wrapper around everything BELOW
 * the hero (title, slot list, map, CTA).
 *
 * 2026-09-15 report — two real bugs in the previous version, both from the
 * same root cause. The hero is in-flow (see the note below on why it has to
 * be), so as it shrinks during scroll, it shrinks the scrollable content
 * too — on a page shorter than the collapse distance, that can pull the
 * "real" max-scroll position backward while the browser is actively
 * scrolled there, which the browser corrects by snapping back, which fires
 * another scroll event, which un-shrinks the hero, which... a feedback
 * loop (the reported "scrollbar jittering wildly with no real content
 * movement"). The previous fix was a fixed `contentMinHeight = windowHeight
 * + collapseDistance` spacer — safe against the loop, but it force-pads
 * *every* short resource with that same amount of genuinely empty scroll
 * space below the real content (the reported "sliding to the bottom just
 * hides the carousel for blank space").
 *
 * The fix here: measure how much real scroll room the page actually has
 * (`restContentHeight`, via `onRestContentLayout`) and — only on a page too
 * short to sustain a *full* collapse without going invalid — collapse the
 * hero *partially* instead, by exactly the amount the real content can
 * sustain with zero slack. Solving "hero shrinks 1:1 with scroll, and the
 * page's real bottom lands exactly when the hero finishes collapsing" for a
 * 1:1 slope (true whenever `heroExpanded - heroCollapsed === the normal
 * collapse distance`, which it always is here) gives a closed form:
 *   partialCollapseDistance = (heroExpanded + restContentHeight - windowHeight) / 2
 * — no artificial spacer needed at all, the hero just settles at whatever
 * size the real content allows instead of forcing the full collapse. On a
 * normal (long) page this never kicks in — same full collapse, same zero
 * cost, as before.
 */
export function useCollapsingHero() {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  const heroExpanded = Math.round(
    Math.min(windowHeight * 0.5, HERO_EXPANDED_MAX),
  );
  const heroCollapsed = HERO_HEIGHT + insets.top;
  // Always exactly `heroExpanded - heroCollapsed` — the 1:1-slope premise
  // the closed form above depends on.
  const fullCollapseDistance = Math.max(1, heroExpanded - heroCollapsed);

  const [scrollY] = useState(() => new RNAnimated.Value(0));
  const onScroll = RNAnimated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: false },
  );

  const [restContentHeight, setRestContentHeight] = useState<number | null>(null);
  const onRestContentLayout = useCallback((e: LayoutChangeEvent) => {
    setRestContentHeight(e.nativeEvent.layout.height);
  }, []);

  // Not yet measured (first frame) — assume the common "plenty of content"
  // case rather than guessing short, so there's no visible flash of a
  // partial collapse that then snaps to full once the real measurement
  // lands a moment later.
  const availableScrollRoom =
    restContentHeight == null
      ? Infinity
      : heroExpanded + restContentHeight - windowHeight;

  const canFullyCollapse = availableScrollRoom >= fullCollapseDistance * 2;
  const collapseDistance = canFullyCollapse
    ? fullCollapseDistance
    : Math.max(1, availableScrollRoom / 2);
  const heroFloor = canFullyCollapse
    ? heroCollapsed
    : Math.round(heroExpanded - collapseDistance);

  const heroHeight = scrollY.interpolate({
    inputRange: [0, collapseDistance],
    outputRange: [heroExpanded, heroFloor],
    extrapolate: "clamp",
  });

  return { insets, heroExpanded, heroHeight, onScroll, onRestContentLayout };
}
