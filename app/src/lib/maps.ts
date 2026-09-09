import { GOOGLE_MAPS_STATIC_KEY } from "@/lib/config";

export interface Coords {
  lat: number;
  lng: number;
}

/** "40 m" / "2.3 km" — nearest 10 m below ~1 km, one decimal km above. */
export function formatDistance(meters: number | null | undefined): string | null {
  if (meters == null) return null;
  return meters < 950
    ? `${Math.round(meters / 10) * 10} m`
    : `${(meters / 1000).toFixed(1)} km`;
}

/** Great-circle distance in metres between two lat/lng points. */
export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6_371_000;
  const p = Math.PI / 180;
  const a =
    0.5 -
    Math.cos((lat2 - lat1) * p) / 2 +
    (Math.cos(lat1 * p) *
      Math.cos(lat2 * p) *
      (1 - Math.cos((lon2 - lon1) * p))) /
      2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** True when EXPO_PUBLIC_GOOGLE_MAPS_STATIC_KEY is set — gates whether to attempt a map image at all. */
export function hasMapsStaticKey(): boolean {
  return GOOGLE_MAPS_STATIC_KEY !== null;
}

// Google's dark-mode Static Maps style — desaturated, roughly matching the
// app's own dark palette (lib/theme/palette.ts) rather than Google's default
// bright road/water colors, which would look jarring inside a dark card.
const DARK_STYLE = [
  "element:geometry|color:0x1C1C1E",
  "element:labels.text.fill|color:0x8A8A8E",
  "element:labels.text.stroke|color:0x1C1C1E",
  "feature:road|element:geometry|color:0x2C2C2E",
  "feature:water|element:geometry|color:0x000000",
  "feature:poi|element:labels|visibility:off",
];

/**
 * Static Maps API image URL for the resource-detail hero. Returns null when no
 * key is configured — the caller falls back to the plain placeholder block,
 * never to a broken/errored `<Image>`.
 */
export function staticMapUrl(
  { lat, lng }: Coords,
  {
    width,
    height,
    dark = false,
  }: { width: number; height: number; dark?: boolean },
): string | null {
  if (!GOOGLE_MAPS_STATIC_KEY) return null;

  const params = new URLSearchParams({
    center: `${lat},${lng}`,
    zoom: "15",
    size: `${width}x${height}`,
    scale: "2",
    markers: `color:0xC2571F|${lat},${lng}`,
    key: GOOGLE_MAPS_STATIC_KEY,
  });
  if (dark) {
    for (const rule of DARK_STYLE) params.append("style", rule);
  }

  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

/**
 * A universal Google Maps *directions* link: opens the native Google Maps app
 * on a phone, the web app in a browser — same URL, no platform branching.
 * Only a `destination` is set, so Google routes from the device's current
 * location ("Tu ubicación"). Prefers coordinates (exact); falls back to a
 * text address when only that is available.
 */
export function directionsUrl(input: Coords | { address: string }): string {
  const destination =
    "address" in input
      ? encodeURIComponent(input.address)
      : `${input.lat},${input.lng}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
}

// --- Web Mercator px <-> lat/lng ------------------------------------------
// Matches the projection `staticMapUrl` renders with (256-px tile, the given
// `zoom`, logical/CSS pixels — the scale=2 image is 2x the pixels but the same
// geographic span, so pass the logical width/height and `locationX/Y`).

const TILE_SIZE = 256;
const MAX_LAT = 85.05112878;

const clampLat = (lat: number) => Math.max(Math.min(lat, MAX_LAT), -MAX_LAT);

/** lat/lng -> world pixel coordinates at zoom 0 (each axis 0..256). */
export function project(lat: number, lng: number): { x: number; y: number } {
  const siny = Math.min(
    Math.max(Math.sin((clampLat(lat) * Math.PI) / 180), -0.9999),
    0.9999,
  );
  return {
    x: TILE_SIZE * (0.5 + lng / 360),
    y: TILE_SIZE * (0.5 - Math.log((1 + siny) / (1 - siny)) / (4 * Math.PI)),
  };
}

/** Inverse of {@link project}. */
export function unproject(x: number, y: number): Coords {
  const lng = (x / TILE_SIZE - 0.5) * 360;
  const n = Math.PI * (1 - (2 * y) / TILE_SIZE);
  const lat = (2 * Math.atan(Math.exp(n)) - Math.PI / 2) * (180 / Math.PI);
  return { lat, lng };
}

/**
 * A tap at pixel (px, py) from the map image's top-left corner -> lat/lng,
 * given the map's center, zoom and logical size.
 */
export function pxToLatLng(
  px: number,
  py: number,
  center: Coords,
  zoom: number,
  width: number,
  height: number,
): Coords {
  const scale = 2 ** zoom;
  const c = project(center.lat, center.lng);
  const worldX = c.x + (px - width / 2) / scale;
  const worldY = c.y + (py - height / 2) / scale;
  return unproject(worldX, worldY);
}

/**
 * Cheaper linear approximation: a pixel *delta* -> a lat/lng delta. Fine for
 * small nudges / lower zooms; {@link pxToLatLng} is exact.
 */
export function pxDeltaToLatLng(
  dx: number,
  dy: number,
  lat: number,
  zoom: number,
): { dLat: number; dLng: number } {
  const metersPerPx =
    (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
  return {
    dLat: -(dy * metersPerPx) / 111_320,
    dLng: (dx * metersPerPx) / (111_320 * Math.cos((lat * Math.PI) / 180)),
  };
}
