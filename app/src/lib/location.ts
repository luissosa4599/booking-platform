import * as Location from "expo-location";

import type { Coords } from "@/lib/maps";

export type LocationPermissionState = "granted" | "denied" | "undetermined";

// Once the user says no, don't keep prompting on our own — Explore silently
// falls back to the "soonest" sort. A fresh app launch resets this (module
// scope). A real grant (e.g. flipped on in the OS settings) always wins over
// this flag — every check below reads the live permission first.
let deniedThisSession = false;

export interface LocationPermission {
  granted: boolean;
  canAskAgain: boolean;
  /** "undetermined" = never asked; "denied" = asked and refused. */
  status: "granted" | "denied" | "undetermined";
}

/** The live OS permission (no dialog). `null` if it can't be read. */
export async function getLocationPermission(): Promise<LocationPermission | null> {
  try {
    const { status, granted, canAskAgain } = await Location.getForegroundPermissionsAsync();
    return { status, granted, canAskAgain };
  } catch {
    return null;
  }
}

export async function getPermissionState(): Promise<LocationPermissionState> {
  const p = await getLocationPermission();
  if (p?.granted) return "granted";
  if (deniedThisSession) return "denied";
  if (!p) return "undetermined";
  if (p.status === "denied" && !p.canAskAgain) return "denied";
  return "undetermined";
}

/**
 * The device position **only if permission is already granted** — never shows
 * the OS dialog. Used at app start: the dialog itself is only ever shown after
 * an explanation (the tutorial's permissions step) or a user tap that
 * obviously needs it ("Más cerca", "Usar mi ubicación").
 */
export async function getPositionIfGranted(): Promise<Coords | null> {
  if ((await getPermissionState()) !== "granted") return null;
  try {
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}

/**
 * Requests foreground permission (if needed) and returns the device position.
 * Returns null on denial or any error — the caller must degrade gracefully and
 * never block on it.
 */
export async function requestAndGetPosition(): Promise<Coords | null> {
  try {
    const current = await Location.getForegroundPermissionsAsync();
    if (!current.granted && deniedThisSession) return null;
    const { status } = current.granted
      ? current
      : await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      deniedThisSession = true;
      return null;
    }
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}

/**
 * Live position updates ("cuando in use"). Calls `onChange` on every fix and
 * returns a stop function. Returns a no-op stop on denial / error. `distanceMs`
 * is the min metres of movement before another update fires.
 */
export async function watchPosition(
  onChange: (coords: Coords) => void,
  distanceMeters = 25,
): Promise<() => void> {
  try {
    const current = await Location.getForegroundPermissionsAsync();
    if (!current.granted && deniedThisSession) return () => {};
    const { status } = current.granted
      ? current
      : await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      deniedThisSession = true;
      return () => {};
    }
    const sub = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        distanceInterval: distanceMeters,
        timeInterval: 5000,
      },
      (pos) => onChange({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
    );
    return () => sub.remove();
  } catch {
    return () => {};
  }
}
