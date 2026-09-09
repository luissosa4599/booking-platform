import { useState } from "react";
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Image } from "expo-image";

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

  const uris = photos.length > 0 ? photos : [fallbackUrl];

  function onLayout(e: LayoutChangeEvent) {
    setWidth(e.nativeEvent.layout.width);
  }

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (width <= 0) return;
    setPage(Math.round(e.nativeEvent.contentOffset.x / width));
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
});
