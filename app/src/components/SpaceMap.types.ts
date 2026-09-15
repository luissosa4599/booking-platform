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

// The selected-place card's own top offset, web-only. First tried anchoring
// the card to the BOTTOM with the MapListFab toggle coupled to sit right
// above it (2026-09-14 report: "la alineación... se ve rara") — the
// reference design actually wants the opposite arrangement: the toggle
// fixed near the tab bar, the card near the TOP of the map (2026-09-14
// report: "el objetivo es el toggle abajo y la card arriba, como en el
// design"). The toggle is a plain fixed `bottomOffset` on `MapListFab` now
// (index.tsx), no longer coupled to anything here.
export const SELECTED_CARD_TOP = 16;
