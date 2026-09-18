// tsconfig.json's `types` array is deliberately scoped to just `jest`, so
// @types/google.maps (a transitive dep of @vis.gl/react-google-maps, used
// below for FitToPlaces' imperative `google.maps.LatLngBounds`/`event`
// calls) isn't auto-included — pull it in locally instead of widening the
// global compiler config for one file's use of the raw Maps JS API.
/// <reference types="google.maps" />

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { View } from "react-native";
import {
  AdvancedMarker,
  APIProvider,
  ColorScheme,
  Map as GoogleMap,
  useMap,
} from "@vis.gl/react-google-maps";

import { useColorScheme } from "nativewind";

import { GOOGLE_MAPS_STATIC_KEY } from "@/lib/config";
import { palette } from "@/lib/theme/palette";
import { CenterOnMeButton, EmptyPlacesNotice, SelectedPlaceCard } from "./SpaceMapOverlays";
import type { MapPlace, SpaceMapProps } from "./SpaceMap.types";

/**
 * The Explore map (PR #10, redesigned 2026-09-14 per the Direction A
 * reference). Web engine: `@vis.gl/react-google-maps` + the Maps JavaScript
 * API (`EXPO_PUBLIC_GOOGLE_MAPS_STATIC_KEY`, referrer-restricted). Native
 * uses `react-native-maps` instead — see `SpaceMap.native.tsx` — sharing the
 * same `SpaceMapProps`/`MapPlace` contract and the `SelectedPlaceCard`/
 * `EmptyPlacesNotice` overlays (`SpaceMapOverlays.tsx`).
 *
 * **Markers are plain colored circles**, not Google's `<Pin>` teardrop —
 * matches the reference exactly (2026-09-14 report). Selected gets its own
 * distinct color (not just a scale bump) so "which one did I tap" is never
 * ambiguous.
 *
 * **The selected place's card is a real RN `View`, absolutely positioned at
 * the bottom of the map container, directly above the Lista/Mapa toggle —
 * not an `InfoWindow` anchored to the pin.**
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
// Bumped from 22/26 to match the reference's larger pins (2026-09-14 report).
const CIRCLE_SIZE = 32;
const CIRCLE_SIZE_SELECTED = 38;
// `fitBounds` on a single pin (or a very tight cluster) zooms all the way in
// to street level — the actual "trampa" to avoid (2026-09-15 report: "no
// caer en trampas"). Capped at a sensible neighborhood-level max instead of
// trusting fitBounds' own zoom unconditionally.
const MAX_AUTO_ZOOM = 15;
// The other side of the same trap (2026-09-15 report, second look): seeded
// resources span several Mexican states, so a couple of far-apart pins made
// `fitBounds` zoom out to a whole-region/country view (Texas-to-Guatemala) —
// technically "every pin fits", practically useless for "find something
// near me". A metro/regional floor means distant pins can fall off-screen
// (pan to find them) rather than sacrificing the zoom everyone actually
// wants for the common, nearby-cluster case.
const MIN_AUTO_ZOOM = 9;
const FIT_BOUNDS_PADDING_PX = 56;

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
  const mapInstanceRef = useRef<google.maps.Map | null>(null);

  const center = useMemo(() => {
    if (userPosition) return userPosition;
    if (places.length === 0) return MEXICO_CITY;
    const lat = places.reduce((s, p) => s + p.lat, 0) / places.length;
    const lng = places.reduce((s, p) => s + p.lng, 0) / places.length;
    return { lat, lng };
  }, [places, userPosition]);

  const selected = places.find((p) => p.resourceId === selectedId) ?? null;

  function centerOnMe() {
    if (!userPosition || !mapInstanceRef.current) return;
    mapInstanceRef.current.panTo(userPosition);
    mapInstanceRef.current.setZoom(15);
  }

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
          <FitToPlaces places={places} userPosition={userPosition} />
          <MapInstanceCapture mapRef={mapInstanceRef} />

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

      {userPosition ? <CenterOnMeButton onPress={centerOnMe} /> : null}

      {/* 2026-09-15 report: "manejar el caso de que no haya pines activos" —
          no silent empty map. */}
      {places.length === 0 ? <EmptyPlacesNotice /> : null}
    </View>
  );
}

// Adjusts the live map instance's center/zoom to fit every current pin
// (+ the user's own dot), instead of the old fixed `defaultZoom={11}` —
// which only ever matched pins clustered near Mexico City and showed
// nothing for the seeded campuses spread across other states (2026-09-15
// report: "ajustar el zoom del mapa para que al menos se vea un pin").
// `defaultCenter`/`defaultZoom` on `<Map>` stay as the pre-fit fallback
// (first paint, before this effect runs, and the empty-places case, which
// skips fitBounds entirely).
function FitToPlaces({
  places,
  userPosition,
}: {
  places: MapPlace[];
  userPosition: SpaceMapProps["userPosition"];
}) {
  const map = useMap();

  // 2026-09-15 report: "al hacer zoom eventualmente me regresa al zoom
  // inicial y no me deja pasar de cierto zoom in" — `places` is a fresh
  // array every time ExploreScreen re-renders (a 60s background
  // availability refetch, a live-location tick, ...) even when the actual
  // *set* of pins hasn't changed, and the effect below was keyed on that
  // array's identity — so it kept re-firing `fitBounds`, fighting (and
  // eventually winning over) the user's own manual zoom/pan. Two fixes:
  // (1) key the effect on a stable string of resourceIds instead of the
  // array reference, so it only re-fits when the pins *themselves* change;
  // (2) read `userPosition` through a ref rather than depending on it
  // directly — a live GPS watch ticks far more often than that, and every
  // tick was an independent re-fit trigger on its own.
  const placesKey = places
    .map((p) => p.resourceId)
    .sort()
    .join(",");
  const userPositionRef = useRef(userPosition);
  useEffect(() => {
    userPositionRef.current = userPosition;
  }, [userPosition]);

  useEffect(() => {
    if (!map || places.length === 0) return;
    const userPos = userPositionRef.current;

    const bounds = new google.maps.LatLngBounds();
    for (const p of places) bounds.extend({ lat: p.lat, lng: p.lng });
    if (userPos) bounds.extend(userPos);

    map.fitBounds(bounds, FIT_BOUNDS_PADDING_PX);

    // fitBounds' own zoom can land arbitrarily close for one pin or a tight
    // cluster — clamp it after the map settles, don't trust it blind.
    const listener = google.maps.event.addListenerOnce(map, "bounds_changed", () => {
      const zoom = map.getZoom();
      if (zoom == null) return;

      if (zoom > MAX_AUTO_ZOOM) {
        map.setZoom(MAX_AUTO_ZOOM);
        return;
      }
      if (zoom < MIN_AUTO_ZOOM) {
        // Pins too spread out to fit at a useful zoom — fitBounds' own
        // center is just the geometric mean of the extremes, which can
        // land in genuinely empty space (open water, between two distant
        // clusters — confirmed via screenshot, 2026-09-15). Recenter on a
        // real point of interest instead: the user's own position if
        // known, else whichever pin actually sits closest to that
        // centroid. Far pins fall off-screen (pan to find them) rather
        // than the view holding on nothing.
        const boundsCenter = bounds.getCenter();
        const center =
          userPos ??
          nearestPlaceTo(places, { lat: boundsCenter.lat(), lng: boundsCenter.lng() });
        map.setCenter(center);
        map.setZoom(MIN_AUTO_ZOOM);
      }
    });
    return () => listener.remove();
    // Deliberately `placesKey` (a stable resourceId-set fingerprint), not
    // `places` itself or `userPosition` — see the comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, placesKey]);

  return null;
}

// Purely imperative — grabs the live `google.maps.Map` instance into a ref
// owned by the parent so the "center on me" button (rendered *outside*
// `<GoogleMap>`, alongside `SelectedPlaceCard`) can drive it directly. Same
// "a plain child of `<Map>` can call `useMap()`" trick `FitToPlaces` already
// relies on — this one just exposes the instance instead of acting on it.
function MapInstanceCapture({ mapRef }: { mapRef: MutableRefObject<google.maps.Map | null> }) {
  const map = useMap();
  useEffect(() => {
    mapRef.current = map ?? null;
  }, [map, mapRef]);
  return null;
}

function nearestPlaceTo(
  places: MapPlace[],
  center: { lat: number; lng: number },
): { lat: number; lng: number } {
  // Plain planar distance — fine for "which of these is visually closest
  // to this point on a map", no need for haversine precision here.
  let best = places[0]!;
  let bestDist = Infinity;
  for (const p of places) {
    const d = (p.lat - center.lat) ** 2 + (p.lng - center.lng) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return { lat: best.lat, lng: best.lng };
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
  // `tint-soft` (a lighter shade of the same brand color), not an unrelated
  // hue like `state-waiting` blue — stays inside the app's own color
  // language instead of introducing a new accent (2026-09-14 report).
  const background = selected ? colors["tint-soft"] : free ? colors.tint : colors.card;
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

