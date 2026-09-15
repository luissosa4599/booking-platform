/** One marker on the Explore map — a resource with current availability. */
export interface MapPlace {
  resourceId: string;
  name: string;
  locationName: string;
  lat: number;
  lng: number;
  /** `free` = bookable now; `soon` = opens later, `soonMinutes` from now. */
  state: "free" | "soon";
  soonMinutes: number | null;
  distanceLabel: string | null;
  actionLabel: string;
  /** Redesign handoff §"SelectedPinCard" — stock photo by resource type,
   * same fallback as the Explore list cards. */
  imageUri: string;
  /** Already abbreviated (e.g. "48"), no "lugares" word. */
  capacityLabel: string;
}

export interface SpaceMapProps {
  places: MapPlace[];
  selectedId: string | null;
  onSelect: (resourceId: string) => void;
  onAction: (resourceId: string) => void;
  userPosition: { lat: number; lng: number } | null;
}

// Two earlier attempts both missed the reference: first the card was
// bottom-anchored with the toggle coupled to sit ABOVE it — wrong, that put
// the toggle farther from the tab bar than the card. Then, misreading "toggle
// abajo, card arriba" literally, the card moved to the TOP of the map
// entirely, decoupled from the toggle — also wrong; the reference (2026-09-14
// report, image) has both docked together near the BOTTOM, card directly
// above the toggle, toggle closest to the tab bar.
//
// MapListFab's own height (index.tsx renders it, not this file — kept here
// only so this math has a name instead of a bare "44"). Web-only; native
// doesn't render a map at all yet (SpaceMap.native is a placeholder).
export const MAP_TOGGLE_HEIGHT = 44;
// The toggle's resting distance from the map container's bottom edge in map
// view, selected or not — clears Google's mandatory attribution strip
// (~14px tall, self-anchors flush against that same edge) with margin to
// spare, measured live via getBoundingClientRect.
export const MAP_TOGGLE_BOTTOM = 28;
// The selected-place card sits directly above the toggle with a 12px gap —
// a coupled offset, not an independently-tuned number, so the two can never
// drift apart again.
export const SELECTED_CARD_BOTTOM = MAP_TOGGLE_BOTTOM + MAP_TOGGLE_HEIGHT + 12;
