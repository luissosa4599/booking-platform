import { create } from "zustand";

import { watchPosition } from "@/lib/location";
import { haversineMeters, type Coords } from "@/lib/maps";

// How far the device must move before the "sort anchor" catches up — keeps the
// server-sorted list from churning while you walk (distance *labels* still
// update on every fix, from `position`).
const SORT_ANCHOR_METERS = 300;

interface LocationState {
  /** Last known device position while watching; null before the first fix. */
  position: Coords | null;
  /**
   * A lagging copy of `position` that only jumps once you've moved
   * `SORT_ANCHOR_METERS`. Use this for the `/availability?sort=nearest` request.
   */
  sortAnchor: Coords | null;
  watching: boolean;
  /** Idempotent — safe to call from several screens. No-op on denial. */
  ensureWatching: () => void;
  stop: () => void;
}

let unsubscribe: (() => void) | null = null;

export const useLocationStore = create<LocationState>((set, get) => ({
  position: null,
  sortAnchor: null,
  watching: false,

  ensureWatching: () => {
    if (get().watching) return;
    set({ watching: true });
    void watchPosition((coords) => {
      const { sortAnchor } = get();
      const anchorMoved =
        !sortAnchor ||
        haversineMeters(sortAnchor.lat, sortAnchor.lng, coords.lat, coords.lng) >
          SORT_ANCHOR_METERS;
      set({ position: coords, ...(anchorMoved ? { sortAnchor: coords } : {}) });
    }, 25).then((stop) => {
      if (get().watching) unsubscribe = stop;
      else stop();
    });
  },

  stop: () => {
    unsubscribe?.();
    unsubscribe = null;
    set({ watching: false });
  },
}));

/** Live metres from the device to a target, or null if either is missing. */
export function distanceToMeters(
  from: Coords | null,
  lat: number | null | undefined,
  lng: number | null | undefined,
): number | null {
  if (!from || lat == null || lng == null) return null;
  return haversineMeters(from.lat, from.lng, lat, lng);
}
