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

// The selected-place card's own bottom offset + total height (56 thumbnail +
// 10*2 padding), web-only — index.tsx's MapListFab reads these to anchor
// itself right above the card whenever one is showing, instead of the two
// sitting at independently-fixed offsets that could drift out of sync with
// each other (2026-09-14 report: "la alineación... se ve rara"). Live here
// (not SpaceMap.web.tsx) so the plain number import works identically on
// every platform — no platform-suffix resolution ambiguity for a shared
// caller like index.tsx.
export const SELECTED_CARD_BOTTOM = 100;
export const SELECTED_CARD_HEIGHT = 76;
