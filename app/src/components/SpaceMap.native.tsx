import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from "react-native-maps";

import { useColorScheme } from "nativewind";

import { palette } from "@/lib/theme/palette";
import { CenterOnMeButton, EmptyPlacesNotice, SelectedPlaceCard } from "./SpaceMapOverlays";
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
// far-flung pins) — tuned against a real emulator pass, 2026-09-18.
const MIN_DELTA = 0.02;
const MAX_DELTA = 0.9;
// A raw lat/lng bounding-box multiplier standing in for `fitToCoordinates`'s
// own pixel-based edge padding — see `regionForCoords` below.
const BOUNDS_PADDING_FACTOR = 1.4;

// Module-level, not component state (2026-09-18 report: "que continue con la
// ultima posicion en la que se dejo... que aparezca [el auto-fit] muchas
// veces no tiene sentido") — `SpaceMap` fully unmounts every time the Lista/
// Mapa toggle switches away (see `(tabs)/index.tsx`), so anything that should
// survive that round-trip within the same app session has to live outside the
// component's own lifecycle. Reset only by a real reload, which is fine: the
// point is just "don't re-play the intro fit animation every single time you
// reopen the map this session".
let lastRegion: Region | null = null;

// Replaces the old "animate to `fitToCoordinates`'s natural fit, then
// separately correct it if the result is outside [MIN_DELTA, MAX_DELTA]"
// two-step dance — that produced a visible zoom-out-then-zoom-in hop on this
// dataset (2026-09-18 report), since the raw fit for ~55 spread-out campuses
// reliably overshot `MAX_DELTA` and needed a second corrective
// `animateToRegion`. Computing (and clamping) the region up front means the
// map only ever animates once.
//
// **The "Golfo de México" bug (2026-09-18 report).** Clamping the *delta*
// alone doesn't fix a bad *center* — `SpaceMap.web.tsx` hit this exact
// problem first (2026-09-15, see its `FitToPlaces`): when the raw bounding
// box needed to fit every pin is wider than the clamp allows, the naive
// midpoint of the extremes (the geometric center of the bounding box) can
// land in genuinely empty space between two distant clusters — open water,
// in this dataset's case, since the seeded campuses span several Mexican
// states. That fix was never ported here when this native map was built two
// days later. Same port: when the pins are too spread out to fit inside
// `MAX_DELTA`, recenter on the user's own position if known, else on
// whichever real pin sits closest to that (otherwise-empty) midpoint —
// never the midpoint itself.
function regionForCoords(
  coords: { latitude: number; longitude: number }[],
  places: MapPlace[],
  userPos: { lat: number; lng: number } | null,
): Region {
  const lats = coords.map((c) => c.latitude);
  const lngs = coords.map((c) => c.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const rawLatDelta = (maxLat - minLat) * BOUNDS_PADDING_FACTOR;
  const rawLngDelta = (maxLng - minLng) * BOUNDS_PADDING_FACTOR;

  let centerLat = (minLat + maxLat) / 2;
  let centerLng = (minLng + maxLng) / 2;
  if ((rawLatDelta > MAX_DELTA || rawLngDelta > MAX_DELTA) && places.length > 0) {
    const recentered = userPos ?? nearestPlaceTo(places, { lat: centerLat, lng: centerLng });
    centerLat = recentered.lat;
    centerLng = recentered.lng;
  }

  return {
    latitude: centerLat,
    longitude: centerLng,
    latitudeDelta: Math.min(MAX_DELTA, Math.max(MIN_DELTA, rawLatDelta)),
    longitudeDelta: Math.min(MAX_DELTA, Math.max(MIN_DELTA, rawLngDelta)),
  };
}

function nearestPlaceTo(
  places: MapPlace[],
  center: { lat: number; lng: number },
): { lat: number; lng: number } {
  // Plain planar distance — fine for "which of these is visually closest to
  // this point on a map", no need for haversine precision here. Mirrors
  // `SpaceMap.web.tsx`'s helper of the same name.
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
  // `fitToCoordinates`/`animateToRegion` are silently dropped on Android if
  // called before the native map surface has finished mounting — the ref
  // exists the moment React commits, but the underlying GoogleMap isn't ready
  // yet. Gate the fit effect on `onMapReady` too (found by an actual
  // on-device/emulator pass, 2026-09-17 — the map rendered real tiles but
  // never auto-framed the pins).
  const [mapReady, setMapReady] = useState(false);
  const placesRef = useRef(places);
  const userPositionRef = useRef(userPosition);
  useEffect(() => {
    placesRef.current = places;
  }, [places]);
  useEffect(() => {
    userPositionRef.current = userPosition;
  }, [userPosition]);

  // Only auto-fit to the pins' bounds once per app session — see the
  // `lastRegion` module variable above. Captured once via a lazy initializer
  // so a region saved *during* this very mount (from the auto-fit itself, or
  // from the user panning/zooming) doesn't retroactively flip this.
  const [shouldAutoFit] = useState(() => lastRegion == null);

  const [initialRegion] = useState<Region>(() => {
    if (lastRegion) return lastRegion;
    const center =
      userPosition ??
      (places.length > 0
        ? {
            lat: places.reduce((s, p) => s + p.lat, 0) / places.length,
            lng: places.reduce((s, p) => s + p.lng, 0) / places.length,
          }
        : MEXICO_CITY);
    return {
      latitude: center.lat,
      longitude: center.lng,
      latitudeDelta: 0.2,
      longitudeDelta: 0.2,
    };
  });

  // Deliberately keyed on a stable resourceId-set fingerprint, not `places`
  // itself — see `SpaceMap.web.tsx`'s `FitToPlaces` for why (a fresh array on
  // every re-render, incl. a live GPS tick, must not re-trigger the fit).
  const placesKey = places
    .map((p) => p.resourceId)
    .sort()
    .join(",");

  useEffect(() => {
    if (!mapReady || !shouldAutoFit) return;
    const current = placesRef.current;
    if (current.length === 0) return;

    const coords = current.map((p) => ({ latitude: p.lat, longitude: p.lng }));
    const userPos = userPositionRef.current;
    if (userPos) coords.push({ latitude: userPos.lat, longitude: userPos.lng });

    mapRef.current?.animateToRegion(regionForCoords(coords, current, userPos), 600);
    // `onRegionChangeComplete` below records the result into `lastRegion`.
  }, [placesKey, mapReady, shouldAutoFit]);

  // Just persistence now — the min/max clamp used to live here as a second,
  // corrective `animateToRegion` after the natural `fitToCoordinates` landed
  // outside [MIN_DELTA, MAX_DELTA], which is exactly what produced the
  // visible zoom-out-then-zoom-in hop (2026-09-18 report). `regionForCoords`
  // clamps before the (now single) animation runs, so there's nothing left to
  // correct here — every settled region (auto-fit or a manual pinch/pan) is
  // simply remembered for the next time this screen mounts.
  function handleRegionChangeComplete(region: Region) {
    lastRegion = region;
  }

  const selected = places.find((p) => p.resourceId === selectedId) ?? null;

  function centerOnMe() {
    if (!userPosition) return;
    mapRef.current?.animateToRegion(
      {
        latitude: userPosition.lat,
        longitude: userPosition.lng,
        latitudeDelta: MIN_DELTA,
        longitudeDelta: MIN_DELTA,
      },
      500,
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={{ flex: 1 }}
        initialRegion={initialRegion}
        customMapStyle={isDark ? DARK_MAP_STYLE : undefined}
        onMapReady={() => setMapReady(true)}
        onRegionChangeComplete={handleRegionChangeComplete}
        showsUserLocation={false}
        showsMyLocationButton={false}
        toolbarEnabled={false}
      >
        {places.map((p) => {
          const selected = p.resourceId === selectedId;
          return (
            <Marker
              // Keying on the selected flag forces React (and the native
              // module) to remount the Marker — a fresh view, correctly
              // snapshotted once — whenever a pin's selected state flips,
              // instead of leaving `tracksViewChanges` permanently on for
              // every pin (2026-09-18 report: "el mapa se esta tardando en
              // abrir"). With ~50-55 seeded resources, continuously
              // re-snapshotting every single marker's custom view on every
              // frame — the old approach — is a well-documented
              // react-native-maps performance trap; this way each marker is
              // only ever snapshotted twice in its lifetime (mount, and
              // whichever one remount its own selection change causes).
              key={`${p.resourceId}-${selected}`}
              coordinate={{ latitude: p.lat, longitude: p.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
              zIndex={selected ? 20 : 1}
              onPress={() => onSelect(p.resourceId)}
              tracksViewChanges={false}
            >
              <NativeCircleMarker place={p} selected={selected} colors={c} />
            </Marker>
          );
        })}

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

      {userPosition ? <CenterOnMeButton onPress={centerOnMe} /> : null}

      {places.length === 0 ? <EmptyPlacesNotice /> : null}
    </View>
  );
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
