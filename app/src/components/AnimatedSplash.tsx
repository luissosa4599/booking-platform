import { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { useColorScheme } from "nativewind";
import * as SplashScreen from "expo-splash-screen";

import { BRAND, BRAND_TAGLINE } from "@/lib/brand";
import { useReduceMotion } from "@/lib/useReduceMotion";

// Handoff "Splash A — Ensamble seco", 620 ms, single curve.
const EASE = Easing.bezier(0.16, 1, 0.3, 1);
const STEM_H = 80;

// Splash palette (handoff § "Splash" table) — fixed brand colours, never the
// themeable `tint*` tokens.
const PALETTE = {
  light: {
    bg: BRAND.wash,
    occupied: BRAND.base,
    free: BRAND.soft,
    stem: BRAND.press,
    word: BRAND.ink,
    tag: BRAND.press,
  },
  dark: {
    bg: BRAND.ink,
    occupied: BRAND.soft,
    free: "rgba(232,168,131,0.34)",
    stem: BRAND.base,
    word: "#FFFFFF",
    tag: BRAND.soft,
  },
};

interface AnimatedSplashProps {
  /** Fonts loaded + auth hydrated — the splash holds on the final frame until this. */
  appReady: boolean;
  onFinish: () => void;
}

/**
 * The animated splash. Covers the pre-JS gap left by the (image-less) native
 * splash, plays the three-block "ensamble" once, holds the final frame until
 * `appReady`, then fades out. All JS-driven `Animated` (no native driver) —
 * the reliable path in this project (see CLAUDE.md); the stem grows by
 * animating `height`, which is top-anchored for free.
 */
export function AnimatedSplash({ appReady, onFinish }: AnimatedSplashProps) {
  const { colorScheme } = useColorScheme();
  const c = colorScheme === "dark" ? PALETTE.dark : PALETTE.light;
  const reduceMotion = useReduceMotion();

  const [blockL] = useState(() => new Animated.Value(0));
  const [blockR] = useState(() => new Animated.Value(0));
  const [stem] = useState(() => new Animated.Value(0));
  const [lockup] = useState(() => new Animated.Value(0));
  const [fade] = useState(() => new Animated.Value(1));

  const [assembled, setAssembled] = useState(false);

  // Hand the screen over from the native splash, then run the assemble.
  // `reduce motion` → every timing collapses to 0 ms, so the final frame shows
  // at once (handoff: "mostrar el frame final sin movimiento").
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});

    const m = reduceMotion ? 0 : 1;
    const seq = Animated.parallel([
      Animated.timing(blockL, {
        toValue: 1,
        duration: 340 * m,
        delay: 0,
        easing: EASE,
        useNativeDriver: false,
      }),
      Animated.timing(blockR, {
        toValue: 1,
        duration: 340 * m,
        delay: 60 * m,
        easing: EASE,
        useNativeDriver: false,
      }),
      Animated.timing(stem, {
        toValue: 1,
        duration: 340 * m,
        delay: 100 * m,
        easing: EASE,
        useNativeDriver: false,
      }),
      Animated.timing(lockup, {
        toValue: 1,
        duration: 240 * m,
        delay: 240 * m,
        easing: EASE,
        useNativeDriver: false,
      }),
    ]);
    // Guard on `finished` — a dev double-invoke / Fast Refresh runs the
    // cleanup, and `seq.stop()` fires this callback with `finished: false`.
    seq.start(({ finished }) => {
      if (finished) setAssembled(true);
    });
    return () => seq.stop();
  }, [blockL, blockR, stem, lockup, reduceMotion]);

  // Once the assemble is done AND the app is ready, fade out and unmount.
  useEffect(() => {
    if (!assembled || !appReady) return;
    const anim = Animated.timing(fade, {
      toValue: 0,
      duration: 260,
      easing: EASE,
      useNativeDriver: false,
    });
    anim.start(({ finished }) => {
      if (finished) onFinish();
    });
    return () => anim.stop();
  }, [assembled, appReady, fade, onFinish]);

  return (
    <Animated.View
      pointerEvents={appReady ? "none" : "auto"}
      style={[
        StyleSheet.absoluteFill,
        styles.stage,
        { backgroundColor: c.bg, opacity: fade },
      ]}
    >
      <View style={styles.mark}>
        <Animated.View
          style={[
            styles.bl,
            {
              backgroundColor: c.occupied,
              opacity: blockL,
              transform: [
                {
                  translateX: blockL.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-90, 0],
                  }),
                },
              ],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.br,
            {
              backgroundColor: c.free,
              opacity: blockR,
              transform: [
                {
                  translateX: blockR.interpolate({
                    inputRange: [0, 1],
                    outputRange: [90, 0],
                  }),
                },
              ],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.st,
            {
              backgroundColor: c.stem,
              opacity: stem,
              height: stem.interpolate({
                inputRange: [0, 1],
                outputRange: [0, STEM_H],
              }),
            },
          ]}
        />
      </View>

      <Animated.View
        style={{
          alignItems: "center",
          opacity: lockup,
          transform: [
            {
              translateY: lockup.interpolate({
                inputRange: [0, 1],
                outputRange: [10, 0],
              }),
            },
          ],
        }}
      >
        <Text style={[styles.word, { color: c.word }]}>tempo</Text>
        <Text style={[styles.tag, { color: c.tag }]}>{BRAND_TAGLINE}</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignItems: "center",
    justifyContent: "center",
    gap: 40,
    zIndex: 100,
  },
  mark: { width: 132, height: 132 },
  bl: {
    position: "absolute",
    left: 0,
    top: 8,
    width: 60,
    height: 36,
    borderRadius: 9,
  },
  br: {
    position: "absolute",
    left: 72,
    top: 8,
    width: 60,
    height: 36,
    borderRadius: 9,
  },
  st: { position: "absolute", left: 49, top: 52, width: 34, borderRadius: 10 },
  word: {
    fontFamily: "SpaceGrotesk_700Bold",
    fontSize: 40,
    letterSpacing: -1.6,
    lineHeight: 40,
    includeFontPadding: false,
  },
  tag: { fontFamily: "SpaceGrotesk_500Medium", fontSize: 14, marginTop: 10 },
});
