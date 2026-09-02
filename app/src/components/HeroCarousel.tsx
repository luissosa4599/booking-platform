import { useState } from "react";
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Image } from "expo-image";

interface HeroCarouselProps {
  /**
   * The image band's fixed height — the hero's *expanded* height. This View
   * fills its (animated, collapsing) parent and keeps the band vertically
   * centred + clipped, so shrinking the parent reveals the middle of the
   * image, not the top.
   */
  contentHeight: number;
  /** Google Static Maps URL, or null when no key / no coordinates. */
  mapImageUrl: string | null;
  /** A stock photo of the space (Unsplash). Always present. */
  stockImageUrl: string;
  /** Opens directions — wired to the map page (and the whole hero when there's no map). */
  onMapPress?: () => void;
}

/**
 * The resource-detail hero: a horizontal pager over [static map, stock photo].
 * When there's no map it's just the photo (still a single "page", no dots).
 * Everything sits on the same `bg-fill` block underneath, so a page whose
 * image fails to load degrades to grey rather than a broken image.
 */
export function HeroCarousel({
  contentHeight,
  mapImageUrl,
  stockImageUrl,
  onMapPress,
}: HeroCarouselProps) {
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);

  const pages: ("map" | "photo")[] = mapImageUrl ? ["map", "photo"] : ["photo"];

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
            scrollEnabled={pages.length > 1}
            // Fixed-height band, vertically centred by the parent's
            // `justifyContent` — the parent clips the overflow as it collapses.
            style={{ flexGrow: 0, height: contentHeight }}
          >
            {pages.map((kind) => (
              <Pressable
                key={kind}
                onPress={kind === "map" ? onMapPress : undefined}
                disabled={kind !== "map" || !onMapPress}
                accessibilityLabel={
                  kind === "map" ? "Cómo llegar en Google Maps" : undefined
                }
                style={{ width, height: contentHeight }}
              >
                <Image
                  source={{
                    uri: kind === "map" ? mapImageUrl! : stockImageUrl,
                  }}
                  style={{ width, height: contentHeight }}
                  contentFit="cover"
                  contentPosition="center"
                  transition={150}
                  accessibilityIgnoresInvertColors
                />
              </Pressable>
            ))}
          </ScrollView>

          {pages.length > 1 ? (
            <View style={styles.dots}>
              {pages.map((kind, i) => (
                <View
                  key={kind}
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
