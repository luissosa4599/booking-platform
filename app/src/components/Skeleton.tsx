import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { useReduceMotion } from "@/lib/useReduceMotion";
import { useColor } from "@/lib/theme/useColor";

// Shared by every placeholder bar/box below — one shared value per mounted
// skeleton (not module-level) so multiple skeletons on screen don't force
// each other's pulses in and out of sync in a way that reads as flickering.
function useSkeletonPulse() {
  "use no memo";

  const reduceMotion = useReduceMotion();
  // Midpoint of the 0.45–0.9 pulse range, not a static 0.45 — a skeleton
  // that never pulses should still read as "a mid-tone placeholder", not
  // freeze at the pulse's dimmest frame.
  const pulse = useSharedValue(0.675);

  useEffect(() => {
    if (reduceMotion) {
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.9, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.45, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );
  }, [pulse, reduceMotion]);

  return useAnimatedStyle(() => ({
    opacity: Math.min(1, pulse.value),
  }));
}

// A real row shape, not a loading screen — the list never changes shape
// between the loading and loaded states. Never mount this directly; gate it
// with useDelayedFlag(loading, 150) so fast responses never show it at all.
// For a plain text list row (Bookings, the resource-detail slot list) — NOT
// for Explore's ResourceCard-shaped list, see `ResourceCardSkeleton` below.
export function Skeleton() {
  const pulseStyle = useSkeletonPulse();
  // `useColor("label-4")` + inline style, not a `bg-hairline`/`bg-label-4`
  // className — a 2026-09-17 report caught these bars reading as a blank
  // card, not a loading skeleton. Root cause matched this file's other
  // arbitrary/token-className gotchas cited throughout CLAUDE.md (silently
  // zero CSS, or in this case just too-low-contrast `hairline`, tuned to be
  // a barely-there 1px divider, not a filled placeholder shape) — resolved
  // the same way those were: a real color value via `useColor` + inline
  // `style`, not a className at all.
  const barColor = useColor("label-4");

  return (
    <View className="min-h-[56px] flex-row items-center px-4 py-3">
      <View className="flex-1 gap-2">
        <Animated.View
          style={[pulseStyle, { height: 13, width: "48%", borderRadius: 6, backgroundColor: barColor }]}
        />
        <Animated.View
          style={[pulseStyle, { height: 11, width: "30%", borderRadius: 6, backgroundColor: barColor }]}
        />
      </View>
    </View>
  );
}

interface ResourceCardSkeletonProps {
  /** Matches `ResourceCardProps["variant"]` — same breakpoint the real cards
   * use, so the loading state never changes shape once real cards arrive. */
  variant: "stacked" | "row";
}

// Explore's list renders `ResourceCard`s directly (bordered individual
// cards, `gap: 14` between them) — not inside a `Group`. The plain `Skeleton`
// row above (a thin two-line row meant for a `Group`'s divided-list shape)
// read as an empty blank card there: reserving `ResourceCard`'s full height
// (150px stacked / 92px row thumbnail) with only two short text bars left
// most of the card looking unfinished, and the loading→loaded transition
// visibly changed shape (a `Group`'s single divided box → separate bordered
// cards). This mirrors `ResourceCard`'s own layout exactly — same image-box
// size/radius, same button/heart placeholder position, same outer
// border+radius+bg — so the swap-in is just "placeholders turn real", not a
// shape jump.
export function ResourceCardSkeleton({ variant }: ResourceCardSkeletonProps) {
  const pulseStyle = useSkeletonPulse();
  const barColor = useColor("label-4");
  const cardColor = useColor("card");
  const hairlineColor = useColor("hairline");

  function bar(width: `${number}%`, height: number) {
    return (
      <Animated.View
        style={[pulseStyle, { height, width, borderRadius: 6, backgroundColor: barColor }]}
      />
    );
  }

  function box(size: number, borderRadius: number, extraStyle?: object) {
    return (
      <Animated.View
        style={[pulseStyle, { width: size, height: size, borderRadius, backgroundColor: barColor }, extraStyle]}
      />
    );
  }

  if (variant === "row") {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: hairlineColor,
          backgroundColor: cardColor,
          padding: 12,
        }}
      >
        {box(92, 14)}
        <View style={{ flex: 1, gap: 8 }}>
          {bar("70%", 15)}
          {bar("45%", 12)}
          {bar("55%", 12)}
        </View>
        <View style={{ alignItems: "flex-end", gap: 10 }}>
          {box(20, 10)}
          {box(32, 16, { width: 70 })}
        </View>
      </View>
    );
  }

  return (
    <View
      style={{
        overflow: "hidden",
        borderRadius: 22,
        borderWidth: 1,
        borderColor: hairlineColor,
        backgroundColor: cardColor,
      }}
    >
      <Animated.View style={[pulseStyle, { height: 150, width: "100%", backgroundColor: barColor }]} />
      <View style={{ paddingTop: 14, paddingHorizontal: 16, paddingBottom: 16, gap: 10 }}>
        {bar("60%", 15)}
        {bar("40%", 12)}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          {bar("30%", 12)}
          {box(32, 16, { width: 80 })}
        </View>
      </View>
    </View>
  );
}
