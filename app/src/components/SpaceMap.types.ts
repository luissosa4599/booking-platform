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

// The selected-place card's own bottom offset + total height, web-only —
// index.tsx's MapListFab reads these to anchor itself right above the card
// whenever one is showing, instead of the two sitting at independently-fixed
// offsets that could drift out of sync with each other (2026-09-14 report:
// "la alineación... se ve rara"). Live here (not SpaceMap.web.tsx) so the
// plain number import works identically on every platform — no
// platform-suffix resolution ambiguity for a shared caller like index.tsx.
//
// BOTTOM was 100 — measured live (getBoundingClientRect) against a real
// selected card and confirmed it left a ~100px dead strip of bare map
// between the card and the tab bar, which is what read as "not in the
// ideal position" (2026-09-14 report). The map's own container already
// ends exactly at the tab bar's top edge (confirmed by measuring
// MapListFab's own resting position against it) — there's no tab bar
// height left to additionally clear, only a small breathing margin. Google's
// mandatory attribution strip (Terms/Google logo) is only ~14px tall and
// self-anchors flush against that same edge, so 28 clears it with margin to
// spare. HEIGHT bumped 76 -> 84 to match the card's real measured height
// (56 thumbnail + padding undercounted the 3-line text column's actual
// line-height).
export const SELECTED_CARD_BOTTOM = 28;
export const SELECTED_CARD_HEIGHT = 84;
