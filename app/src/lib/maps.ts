import { GOOGLE_MAPS_STATIC_KEY } from "@/lib/config";

interface Coords {
  lat: number;
  lng: number;
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
