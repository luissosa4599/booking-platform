import { useMemo } from "react";
import { Image, Pressable, Text, View } from "react-native";
import {
  AdvancedMarker,
  APIProvider,
  ColorScheme,
  Map as GoogleMap,
} from "@vis.gl/react-google-maps";

import { useColorScheme } from "nativewind";

import { Button } from "@/components/Button";
import { GOOGLE_MAPS_STATIC_KEY } from "@/lib/config";
import { palette } from "@/lib/theme/palette";
import type { MapPlace, SpaceMapProps } from "./SpaceMap.types";

/**
 * The Explore map (PR #10, redesigned 2026-09-14 per the Direction A
 * reference). Web only: `@vis.gl/react-google-maps` + the Maps JavaScript
 * API (`EXPO_PUBLIC_GOOGLE_MAPS_STATIC_KEY`, referrer-restricted). Native
 * falls back to the list — see `SpaceMap.native.tsx`.
 *
 * **Markers are plain colored circles**, not Google's `<Pin>` teardrop —
 * matches the reference exactly (2026-09-14 report). Selected gets its own
 * distinct color (not just a scale bump) so "which one did I tap" is never
 * ambiguous.
 *
 * **The selected place's card is a real RN `View`, absolutely positioned at
 * the bottom of the map container — not an `InfoWindow` anchored to the pin.**
 * This is simpler than the previous approach, not just prettier: it sits
 * completely outside `AdvancedMarker`'s collision-managed rendering path (the
 * thing that made a nested "Apartar" button unclickable in the very first
 * version of this map — see git history), so there's no special-casing
 * needed to keep it interactive.
 *
 * `AdvancedMarker` needs a vector map id; `DEMO_MAP_ID` is Google's public
 * dev id and works with no cloud setup. Set `EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID`
 * to your own (unstyled) vector map id for production — `DEMO_MAP_ID` is
 * dev-only. Dark tiles come from the Maps JS API's built-in `colorScheme`
 * (no cloud style needed), driven off the app theme.
 */
const MAP_ID = process.env.EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";
const MEXICO_CITY = { lat: 19.4326, lng: -99.1332 };
const CIRCLE_SIZE = 22;
const CIRCLE_SIZE_SELECTED = 26;

export function SpaceMap({
  places,
  selectedId,
  onSelect,
  onAction,
  userPosition,
}: SpaceMapProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const c = palette(isDark ? "dark" : "light");

  const center = useMemo(() => {
    if (userPosition) return userPosition;
    if (places.length === 0) return MEXICO_CITY;
    const lat = places.reduce((s, p) => s + p.lat, 0) / places.length;
    const lng = places.reduce((s, p) => s + p.lng, 0) / places.length;
    return { lat, lng };
  }, [places, userPosition]);

  const selected = places.find((p) => p.resourceId === selectedId) ?? null;

  if (!GOOGLE_MAPS_STATIC_KEY) {
    return (
      <View className="flex-1 items-center justify-center bg-fill px-8">
        <View className="text-body text-label-3" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <APIProvider apiKey={GOOGLE_MAPS_STATIC_KEY}>
        <GoogleMap
          defaultCenter={center}
          defaultZoom={userPosition ? 13 : 11}
          mapId={MAP_ID}
          colorScheme={isDark ? ColorScheme.DARK : ColorScheme.LIGHT}
          disableDefaultUI
          zoomControl
          gestureHandling="greedy"
          style={{ width: "100%", height: "100%" }}
        >
          {places.map((p) => (
            <CircleMarker
              key={p.resourceId}
              place={p}
              selected={p.resourceId === selectedId}
              onSelect={onSelect}
              colors={c}
            />
          ))}

          {userPosition ? (
            <AdvancedMarker position={userPosition} zIndex={5}>
              <div
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  background: c["state-waiting"],
                  border: "3px solid #fff",
                  boxShadow: `0 0 0 4px ${c["state-waiting"]}40`,
                }}
              />
            </AdvancedMarker>
          ) : null}
        </GoogleMap>
      </APIProvider>

      {selected ? (
        <SelectedPlaceCard place={selected} onAction={() => onAction(selected.resourceId)} />
      ) : null}
    </View>
  );
}

function CircleMarker({
  place,
  selected,
  onSelect,
  colors,
}: {
  place: MapPlace;
  selected: boolean;
  onSelect: (resourceId: string) => void;
  colors: ReturnType<typeof palette>;
}) {
  const free = place.state === "free";
  // Selected gets its own color — never just a size bump — so which pin is
  // "the one I tapped" is unambiguous even among several free/soon pins.
  const background = selected ? colors["state-waiting"] : free ? colors.tint : colors.card;
  const size = selected ? CIRCLE_SIZE_SELECTED : CIRCLE_SIZE;

  return (
    <AdvancedMarker
      position={{ lat: place.lat, lng: place.lng }}
      zIndex={selected ? 20 : 1}
      onClick={() => onSelect(place.resourceId)}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background,
          border: `3px solid ${colors.card}`,
          boxShadow: selected
            ? `0 4px 10px rgba(11,11,12,0.2)`
            : "0 1px 4px rgba(11,11,12,0.25)",
        }}
      />
    </AdvancedMarker>
  );
}

// Redesign handoff §"SelectedPinCard" — a horizontal card anchored to the
// bottom of the map, reusing the same visual language as `ResourceCard`'s
// row variant (photo thumbnail + text + compact CTA) at a smaller size.
function SelectedPlaceCard({ place, onAction }: { place: MapPlace; onAction: () => void }) {
  const statusLabel = place.state === "free" ? "Libre" : `Libre en ${place.soonMinutes} min`;

  return (
    <View
      className="border border-hairline bg-card"
      style={{
        position: "absolute",
        left: 16,
        right: 16,
        // Clears the Lista/Mapa FAB (bottom 96 + its own 44px height = a
        // 140px top edge) with a 16px gap — was 88, which overlapped it
        // (2026-09-14 report, confirmed via screenshot).
        bottom: 156,
        borderRadius: 16,
        padding: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        shadowColor: "#0B0B0C",
        shadowOpacity: 0.14,
        shadowRadius: 30,
        shadowOffset: { width: 0, height: 12 },
        elevation: 6,
      }}
    >
      <Image
        source={{ uri: place.imageUri }}
        style={{ width: 56, height: 56, borderRadius: 10 }}
        resizeMode="cover"
      />
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} className="text-body-emph text-label-1">
          {place.name}
        </Text>
        <Text numberOfLines={1} className="text-footnote text-label-3">
          {place.locationName} · {place.capacityLabel}
        </Text>
        <Text numberOfLines={1} className="text-footnote">
          <Text
            className={place.state === "free" ? "text-state-free" : "text-state-last"}
            style={{ fontWeight: "600" }}
          >
            {statusLabel}
          </Text>
        </Text>
      </View>
      <Pressable onPress={(e) => e.stopPropagation()}>
        <Button variant="pill" tone="filled" onPress={onAction}>
          {place.actionLabel}
        </Button>
      </Pressable>
    </View>
  );
}
