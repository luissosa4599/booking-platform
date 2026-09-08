import * as Location from "expo-location";

import type { Coords } from "@/lib/maps";

export type LocationPermissionState = "granted" | "denied" | "undetermined";

// Once the user says no, don't keep prompting — Explore silently falls back to
// the "soonest" sort. A fresh app launch resets this (module scope).
let deniedThisSession = false;

export async function getPermissionState(): Promise<LocationPermissionState> {
  if (deniedThisSession) return "denied";
  try {
    const { status, canAskAgain } = await Location.getForegroundPermissionsAsync();
    if (status === "granted") return "granted";
    if (status === "denied" && !canAskAgain) return "denied";
    return "undetermined";
  } catch {
    return "undetermined";
  }
}

/**
 * Requests foreground permission (if needed) and returns the device position.
 * Returns null on denial or any error — the caller must degrade gracefully and
 * never block on it.
 */
export async function requestAndGetPosition(): Promise<Coords | null> {
  if (deniedThisSession) return null;
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
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
