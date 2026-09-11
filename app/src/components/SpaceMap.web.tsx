import { useMemo } from "react";
import { View } from "react-native";
import {
  AdvancedMarker,
  APIProvider,
  ColorScheme,
  Map as GoogleMap,
  Pin,
} from "@vis.gl/react-google-maps";

import { useColorScheme } from "nativewind";

import { GOOGLE_MAPS_STATIC_KEY } from "@/lib/config";
import { palette } from "@/lib/theme/palette";
import type { MapPlace, SpaceMapProps } from "./SpaceMap.types";

/**
 * The Explore map (PR #10) — one marker per available resource, a plain
 * Google `<Pin>` coloured by state (free now vs. opens soon). Web only:
 * `@vis.gl/react-google-maps` + the Maps JavaScript API
 * (`EXPO_PUBLIC_GOOGLE_MAPS_STATIC_KEY`, referrer-restricted). Native falls
 * back to the list — see `SpaceMap.native.tsx`.
 *
 * The original custom "T block" marker (matching the brand mark) was
 * reverted to a plain `<Pin>` — it read as a map glitch once markers piled up
 * or overlapped. A better custom marker + clustering is a separate follow-up.
 *
 * `AdvancedMarker` needs a vector map id; `DEMO_MAP_ID` is Google's public
 * dev id and works with no cloud setup. Set `EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID`
 * to your own (unstyled) vector map id for production — `DEMO_MAP_ID` is
 * dev-only. Dark tiles come from the Maps JS API's built-in `colorScheme`
 * (no cloud style needed), driven off the app theme.
 */
const MAP_ID = process.env.EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";
const MEXICO_CITY = { lat: 19.4326, lng: -99.1332 };

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

  const selectedPlace = places.find((p) => p.resourceId === selectedId) ?? null;

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
          {places.map((p) => {
            const free = p.state === "free";
            return (
              <AdvancedMarker
                key={p.resourceId}
                position={{ lat: p.lat, lng: p.lng }}
                zIndex={p.resourceId === selectedId ? 20 : 1}
                onClick={() => onSelect(p.resourceId)}
              >
                <Pin
                  background={free ? c.tint : c.card}
                  borderColor={c.tint}
                  glyphColor={free ? c["on-tint"] : c.tint}
                  glyph={!free && p.soonMinutes != null ? String(p.soonMinutes) : undefined}
                  scale={p.resourceId === selectedId ? 1.15 : 1}
                />
              </AdvancedMarker>
            );
          })}

          {selectedPlace ? (
            <AdvancedMarker
              position={{ lat: selectedPlace.lat, lng: selectedPlace.lng }}
              zIndex={30}
            >
              <PeekCard
                place={selectedPlace}
                colors={c}
                onAction={() => onAction(selectedPlace.resourceId)}
              />
            </AdvancedMarker>
          ) : null}

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
    </View>
  );
}

// The peek card floats above the plain Google `<Pin>` for the selected place.
// It's its own `AdvancedMarker` at the same position (not nested inside the
// pin's marker) so the library's automatic Pin-anchor detection stays intact —
// see CLAUDE.md punch-list item 2 (custom "T block" markers reverted to plain
// pins because they glitched when clustered). `paddingBottom` clears the pin's
// own height instead of a hand-tuned transform.
function PeekCard({
  place,
  colors,
  onAction,
}: {
  place: MapPlace;
  colors: ReturnType<typeof palette>;
  onAction: () => void;
}) {
  return (
    // The map's drag-to-pan gesture starts on `pointerdown`, before a click
    // ever fires — without stopping it here, the tiny mouse movement between
    // press and release on a real click reads as "drag the map" instead of
    // "click the button", so the cursor turns into a grab hand and the
    // Apartar button becomes unclickable. Stopping propagation at the
    // card's root (not just the button's onClick) fixes every interaction
    // inside the card, not just the button.
    <div style={{ paddingBottom: 40 }} onPointerDown={(e) => e.stopPropagation()}>
      <div
        style={{
          width: 208,
          background: colors.card,
          borderRadius: 14,
          padding: 12,
          border: `1px solid ${colors.hairline}`,
          boxShadow: "0 10px 30px -8px rgba(0,0,0,.3)",
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            color: colors["label-1"],
          }}
        >
          {place.name}
        </div>
        <div style={{ fontSize: 12, color: colors["label-3"], margin: "2px 0 10px" }}>
          {place.locationName}
          {place.distanceLabel ? ` · a ${place.distanceLabel}` : ""}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAction();
          }}
          style={{
            display: "block",
            width: "100%",
            textAlign: "center",
            background: colors.tint,
            color: colors["on-tint"],
            fontSize: 13,
            fontWeight: 600,
            border: "none",
            borderRadius: 999,
            padding: "8px 0",
            cursor: "pointer",
          }}
        >
          {place.actionLabel}
        </button>
      </div>
    </div>
  );
}
