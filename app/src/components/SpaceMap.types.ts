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
}

export interface SpaceMapProps {
  places: MapPlace[];
  selectedId: string | null;
  onSelect: (resourceId: string) => void;
  onAction: (resourceId: string) => void;
  userPosition: { lat: number; lng: number } | null;
}
