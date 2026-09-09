import { useMemo } from "react";
import { View } from "react-native";
import {
  AdvancedMarker,
  APIProvider,
  Map as GoogleMap,
} from "@vis.gl/react-google-maps";

import { useColorScheme } from "nativewind";

import { GOOGLE_MAPS_STATIC_KEY } from "@/lib/config";
import { palette } from "@/lib/theme/palette";
import type { MapPlace, SpaceMapProps } from "./SpaceMap.types";

/**
 * The Explore map (PR #10) — one marker per available resource, coloured by
 * state (the block echoes the Tempo "T"). Web only: `@vis.gl/react-google-maps`
 * + the Maps JavaScript API (`EXPO_PUBLIC_GOOGLE_MAPS_STATIC_KEY`, referrer-
 * restricted). Native falls back to the list — see `SpaceMap.native.tsx`.
 *
 * `AdvancedMarker` needs a vector map id; `DEMO_MAP_ID` is Google's public
 * dev id and works with no cloud setup. Set `EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID`
 * to a styled one later for the dark palette.
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
  const c = palette(colorScheme === "dark" ? "dark" : "light");

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
          disableDefaultUI
          zoomControl
          gestureHandling="greedy"
          style={{ width: "100%", height: "100%" }}
        >
          {places.map((p) => (
            <AdvancedMarker
              key={p.resourceId}
              position={{ lat: p.lat, lng: p.lng }}
              zIndex={p.resourceId === selectedId ? 20 : 1}
              onClick={() => onSelect(p.resourceId)}
            >
              <Block
                place={p}
                selected={p.resourceId === selectedId}
                colors={c}
                onAction={() => onAction(p.resourceId)}
              />
            </AdvancedMarker>
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

function Block({
  place,
  selected,
  colors,
  onAction,
}: {
  place: MapPlace;
  selected: boolean;
  colors: ReturnType<typeof palette>;
  onAction: () => void;
}) {
  const free = place.state === "free";
  return (
    <div style={{ position: "relative", transform: "translateY(13px)" }}>
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: 5,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "SpaceGrotesk_500Medium, system-ui, sans-serif",
          fontSize: 11,
          fontWeight: 500,
          background: free ? colors.tint : colors.card,
          border: free ? "none" : `2px solid ${colors.tint}`,
          color: colors["tint-press"],
          boxShadow: selected
            ? `0 0 0 3px ${colors.tint}, 0 2px 6px rgba(0,0,0,.3)`
            : "0 1px 3px rgba(0,0,0,.3)",
        }}
      >
        {!free && place.soonMinutes != null ? place.soonMinutes : null}
      </div>

      {selected ? (
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: "calc(100% + 8px)",
            transform: "translateX(-50%)",
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
      ) : null}
    </div>
  );
}
