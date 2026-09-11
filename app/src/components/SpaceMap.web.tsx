import { useMemo } from "react";
import { View } from "react-native";
import {
  AdvancedMarker,
  APIProvider,
  ColorScheme,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
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
 * **The peek card is a real `<InfoWindow>`, not a second `<AdvancedMarker>`
 * at the same position** (2026-09-11 fix). With this many markers on the
 * map, Google renders `AdvancedMarker` content through a collision-managed
 * path — clicking the *pin* itself still works (its `onClick` maps to one
 * opaque hit region), but a `<button>` nested inside a second, content-only
 * `AdvancedMarker` never receives its own click: the cursor turns into the
 * map's drag-pan grab hand instead, and "Apartar" becomes unclickable.
 * Confirmed via `document.elementFromPoint` — the marker content is placed in
 * a slot literally named `…-internal-hidden-gmp-advanced-markers`. `InfoWindow`
 * is Google's actual purpose-built mechanism for interactive marker popups —
 * a real portalled DOM overlay outside that collision-management path, so
 * nested buttons work exactly like normal HTML. Its default chrome (white
 * bubble, shadow, tail, close ×) is stripped via the `.gm-style-iw-*`
 * overrides in `global.css` — the card supplies its own styling instead.
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
            <PlaceMarker
              key={p.resourceId}
              place={p}
              selected={p.resourceId === selectedId}
              onSelect={onSelect}
              onAction={onAction}
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
    </View>
  );
}

function PlaceMarker({
  place,
  selected,
  onSelect,
  onAction,
  colors,
}: {
  place: MapPlace;
  selected: boolean;
  onSelect: (resourceId: string) => void;
  onAction: (resourceId: string) => void;
  colors: ReturnType<typeof palette>;
}) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const free = place.state === "free";

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: place.lat, lng: place.lng }}
        zIndex={selected ? 20 : 1}
        onClick={() => onSelect(place.resourceId)}
      >
        <Pin
          background={free ? colors.tint : colors.card}
          borderColor={colors.tint}
          glyphColor={free ? colors["on-tint"] : colors.tint}
          glyph={!free && place.soonMinutes != null ? String(place.soonMinutes) : undefined}
          scale={selected ? 1.15 : 1}
        />
      </AdvancedMarker>

      {selected && marker ? (
        <InfoWindow anchor={marker} disableAutoPan headerDisabled>
          <PeekCard place={place} colors={colors} onAction={() => onAction(place.resourceId)} />
        </InfoWindow>
      ) : null}
    </>
  );
}

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
        onClick={onAction}
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
  );
}
