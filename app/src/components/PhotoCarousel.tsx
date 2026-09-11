import { useRef, useState } from "react";
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Image } from "expo-image";

import { ChevronLeft, ChevronRight } from "@/lib/icons";

interface PhotoCarouselProps {
  /**
   * Ordered photo URLs. Empty -> the single `fallbackUrl` image, no dots.
   */
  photos: string[];
  /**
   * The image band's fixed height — the hero's *expanded* height. This View
   * fills its (animated, collapsing) parent and keeps the band vertically
   * centred + clipped, so shrinking the parent reveals the middle of the
   * image, not the top.
   */
  contentHeight: number;
  /** Stock image shown when `photos` is empty (Unsplash, always present). */
  fallbackUrl: string;
}

/**
 * The space-detail hero: a horizontal pager over the space's photos. Everything
 * sits on the same `bg-fill` block underneath, so a page whose image fails to
 * load degrades to grey rather than a broken image. (The map is no longer a
 * hero page — it's a separate `StaticMapCard` at the bottom of the content.)
 */
export function PhotoCarousel({
  photos,
  contentHeight,
  fallbackUrl,
}: PhotoCarouselProps) {
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const uris = photos.length > 0 ? photos : [fallbackUrl];

  function onLayout(e: LayoutChangeEvent) {
    setWidth(e.nativeEvent.layout.width);
  }

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (width <= 0) return;
    setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  }

  // Arrow buttons, web only — a touch swipe advances the pager fine on
  // native/mobile web, but there's no equivalent gesture for a mouse on a
  // laptop, so without these a multi-photo space is stuck on page one there.
  function goTo(next: number) {
    const clamped = Math.max(0, Math.min(uris.length - 1, next));
    scrollRef.current?.scrollTo({ x: clamped * width, animated: true });
    setPage(clamped);
  }

  return (
    <View
      onLayout={onLayout}
      style={[StyleSheet.absoluteFill, styles.clip]}
      className="bg-fill"
    >
      {width > 0 ? (
        <>
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
            scrollEnabled={uris.length > 1}
            style={{ flexGrow: 0, height: contentHeight }}
          >
            {uris.map((uri, i) => (
              <Image
                key={`${i}-${uri}`}
                source={{ uri }}
                style={{ width, height: contentHeight }}
                contentFit="cover"
                contentPosition="center"
                transition={150}
                accessibilityIgnoresInvertColors
              />
            ))}
          </ScrollView>

          {uris.length > 1 ? (
            <View style={styles.dots}>
              {uris.map((uri, i) => (
                <View
                  key={`${i}-${uri}`}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: "#FFFFFF",
                    opacity: i === page ? 1 : 0.5,
                  }}
                />
              ))}
            </View>
          ) : null}

          {uris.length > 1 && Platform.OS === "web" ? (
            <>
              {page > 0 ? (
                <Pressable
                  onPress={() => goTo(page - 1)}
                  accessibilityRole="button"
                  accessibilityLabel="Foto anterior"
                  style={[styles.arrow, styles.arrowLeft]}
                >
                  <ChevronLeft size={18} color="#FFFFFF" />
                </Pressable>
              ) : null}
              {page < uris.length - 1 ? (
                <Pressable
                  onPress={() => goTo(page + 1)}
                  accessibilityRole="button"
                  accessibilityLabel="Foto siguiente"
                  style={[styles.arrow, styles.arrowRight]}
                >
                  <ChevronRight size={18} color="#FFFFFF" />
                </Pressable>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: "hidden",
    justifyContent: "center",
  },
  dots: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 12,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  arrow: {
    position: "absolute",
    top: "50%",
    marginTop: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  arrowLeft: {
    left: 12,
  },
  arrowRight: {
    right: 12,
  },
});
