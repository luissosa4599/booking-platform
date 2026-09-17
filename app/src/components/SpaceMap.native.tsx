import { useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from "react-native-maps";

import { useColorScheme } from "nativewind";

import { palette } from "@/lib/theme/palette";
import { EmptyPlacesNotice, SelectedPlaceCard } from "./SpaceMapOverlays";
import type { MapPlace, SpaceMapProps } from "./SpaceMap.types";

/**
 * Native counterpart of `SpaceMap.web.tsx` (2026-09-17 — replaces the old
 * "map available on web for now" placeholder). Same `SpaceMapProps`/
 * `MapPlace` contract, same `SelectedPlaceCard`/`EmptyPlacesNotice` overlays
 * (`SpaceMapOverlays.tsx`) — only the map engine differs: `react-native-maps`
 * (Google Maps SDK) instead of `@vis.gl/react-google-maps`, since
 * `AdvancedMarker`/the Maps JavaScript API are web-only.
 *
 * Needs an Android-restricted Google Maps SDK key wired into
 * `app.config.ts`'s `react-native-maps` plugin entry (see `.env.example`).
 * **Verifiable only on a real device** — no emulator in this environment, and
 * `react-native-maps` is a native module (a JS-only reload isn't enough after
 * changing this file's native-facing config; a new EAS build is needed for
 * anything beyond a Dev Client already carrying the module).
 */
const MEXICO_CITY = { lat: 19.4326, lng: -99.1332 };
// Circle sizes match the web version exactly (2026-09-14 reference).
const CIRCLE_SIZE = 32;
const CIRCLE_SIZE_SELECTED = 38;
// `fitToCoordinates` doesn't expose a zoom level the way the Maps JS API
// does — clamp on `latitudeDelta` instead (smaller delta = more zoomed in).
// These are a first approximation of the same two traps `SpaceMap.web.tsx`
// already documents (over-zoom on a single/tight pin, over-zoom-out on
// far-flung pins) — tune against a real device, this can't be verified here.
const MIN_DELTA = 0.02;
const MAX_DELTA = 0.9;
const FIT_EDGE_PADDING = { top: 80, right: 56, bottom: 140, left: 56 };

// A commonly-published Google Maps "night mode" style (Google's own map
// styling wizard export, reused widely) — not a pixel match for the app's
// custom dark palette (react-native-maps' `customMapStyle` is a static JSON
// array, unlike the web Maps JS API's live `colorScheme` prop), but enough
// so the map doesn't stay bright-white while the rest of the app is dark.
// Revisit with a proper Cloud-based night style if the mismatch bothers a
// real device pass.
const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#212121" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#757575" }] },
  {
    featureType: "administrative.country",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9e9e9e" }],
  },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#bdbdbd" }],
  },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#181818" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
  {
    featureType: "poi.park",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#1b1b1b" }],
  },
  { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#2c2c2c" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#373737" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3c3c3c" }] },
  {
    featureType: "road.highway.controlled_access",
    elementType: "geometry",
    stylers: [{ color: "#4e4e4e" }],
  },
  { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
  { featureType: "transit", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#000000" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3d3d3d" }] },
];

export function SpaceMap({ places, selectedId, onSelect, onAction, userPosition }: SpaceMapProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const c = palette(isDark ? "dark" : "light");

  const mapRef = useRef<MapView>(null);
  // `fitToCoordinates` is silently dropped on Android if it's called before
  // the native map surface has finished mounting — the ref exists the moment
  // React commits, but the underlying GoogleMap isn't ready yet. Gate the fit
  // effect on `onMapReady` too (found by an actual on-device/emulator pass,
  // 2026-09-17 — the map rendered real tiles but never auto-framed the pins).
  const [mapReady, setMapReady] = useState(false);
  // Set right before an imperative `fitToCoordinates` call, cleared by the
  // next `onRegionChangeComplete` — a one-shot flag so the min/max clamp only
  // ever corrects our own auto-fit, never a user's manual pinch/pan (mirrors
  // `SpaceMap.web.tsx`'s `addListenerOnce(map, "bounds_changed", ...)`).
  const pendingFitRef = useRef(false);
  const placesRef = useRef(places);
  const userPositionRef = useRef(userPosition);
  useEffect(() => {
    placesRef.current = places;
  }, [places]);
  useEffect(() => {
    userPositionRef.current = userPosition;
  }, [userPosition]);

  const initialCenter = useMemo(() => {
    if (userPosition) return userPosition;
    if (places.length === 0) return MEXICO_CITY;
    const lat = places.reduce((s, p) => s + p.lat, 0) / places.length;
    const lng = places.reduce((s, p) => s + p.lng, 0) / places.length;
    return { lat, lng };
    // Only the first value matters — `fitToPlaces` below takes over as soon
    // as it can run, same "defaultCenter is just the pre-fit fallback" story
    // as the web version.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Deliberately keyed on a stable resourceId-set fingerprint, not `places`
  // itself — see `SpaceMap.web.tsx`'s `FitToPlaces` for why (a fresh array on
  // every re-render, incl. a live GPS tick, must not re-trigger the fit).
  const placesKey = places
    .map((p) => p.resourceId)
    .sort()
    .join(",");

  useEffect(() => {
    if (!mapReady) return;
    const current = placesRef.current;
    if (current.length === 0) return;

    const coords = current.map((p) => ({ latitude: p.lat, longitude: p.lng }));
    const userPos = userPositionRef.current;
    if (userPos) coords.push({ latitude: userPos.lat, longitude: userPos.lng });

    pendingFitRef.current = true;
    mapRef.current?.fitToCoordinates(coords, {
      edgePadding: FIT_EDGE_PADDING,
      animated: true,
    });
  }, [placesKey, mapReady]);

  function handleRegionChangeComplete(region: Region) {
    if (!pendingFitRef.current) return;
    pendingFitRef.current = false;

    if (region.latitudeDelta < MIN_DELTA) {
      mapRef.current?.animateToRegion(
        { ...region, latitudeDelta: MIN_DELTA, longitudeDelta: MIN_DELTA },
        200,
      );
      return;
    }
    if (region.latitudeDelta > MAX_DELTA) {
      const userPos = userPositionRef.current;
      const center =
        userPos ??
        nearestPlaceTo(placesRef.current, { lat: region.latitude, lng: region.longitude });
      mapRef.current?.animateToRegion(
        {
          latitude: center.lat,
          longitude: center.lng,
          latitudeDelta: MAX_DELTA,
          longitudeDelta: MAX_DELTA,
        },
        200,
      );
    }
  }

  const selected = places.find((p) => p.resourceId === selectedId) ?? null;

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={{ flex: 1 }}
        initialRegion={{
          latitude: initialCenter.lat,
          longitude: initialCenter.lng,
          latitudeDelta: 0.2,
          longitudeDelta: 0.2,
        }}
        customMapStyle={isDark ? DARK_MAP_STYLE : undefined}
        onMapReady={() => setMapReady(true)}
        onRegionChangeComplete={handleRegionChangeComplete}
        showsUserLocation={false}
        showsMyLocationButton={false}
        toolbarEnabled={false}
      >
        {places.map((p) => (
          <Marker
            key={p.resourceId}
            coordinate={{ latitude: p.lat, longitude: p.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={p.resourceId === selectedId ? 20 : 1}
            onPress={() => onSelect(p.resourceId)}
            // Custom child views need this to re-snapshot on a style change
            // (e.g. selected -> unselected) — with ~50 seeded resources at
            // most in view, always-on tracking is fine; revisit if a real
            // device pass shows jank with a much larger dataset.
            tracksViewChanges
          >
            <NativeCircleMarker place={p} selected={p.resourceId === selectedId} colors={c} />
          </Marker>
        ))}

        {userPosition ? (
          <Marker
            coordinate={{ latitude: userPosition.lat, longitude: userPosition.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={5}
            tracksViewChanges={false}
          >
            <UserDot color={c["state-waiting"]} />
          </Marker>
        ) : null}
      </MapView>

      {selected ? (
        <SelectedPlaceCard place={selected} onAction={() => onAction(selected.resourceId)} />
      ) : null}

      {places.length === 0 ? <EmptyPlacesNotice /> : null}
    </View>
  );
}

function nearestPlaceTo(
  places: MapPlace[],
  center: { lat: number; lng: number },
): { lat: number; lng: number } {
  if (places.length === 0) return center;
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

function NativeCircleMarker({
  place,
  selected,
  colors,
}: {
  place: MapPlace;
  selected: boolean;
  colors: ReturnType<typeof palette>;
}) {
  const free = place.state === "free";
  const background = selected ? colors["tint-soft"] : free ? colors.tint : colors.card;
  const size = selected ? CIRCLE_SIZE_SELECTED : CIRCLE_SIZE;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: background,
        borderWidth: 3,
        borderColor: colors.card,
        shadowColor: "#0B0B0C",
        shadowOpacity: selected ? 0.2 : 0.25,
        shadowRadius: selected ? 10 : 4,
        shadowOffset: selected ? { width: 0, height: 4 } : { width: 0, height: 1 },
        elevation: selected ? 6 : 3,
      }}
    />
  );
}

// Halo via nested Views (a colored ring + a solid dot), not `boxShadow` —
// RN's shadow props don't reliably render a colored ring on Android the way
// web's `box-shadow: 0 0 0 4px ${color}40` does.
function UserDot({ color }: { color: string }) {
  return (
    <View
      style={{
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: `${color}40`,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          width: 16,
          height: 16,
          borderRadius: 8,
          backgroundColor: color,
          borderWidth: 3,
          borderColor: "#fff",
        }}
      />
    </View>
  );
}
