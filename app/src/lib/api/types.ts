// Mirrors the API's response DTOs exactly (api/Application/*/*.cs) — field
// names here must match the backend's JSON output (camelCase), not the
// handoff's illustrative domain model (which uses different names in a few
// places, e.g. `seatsLeft` vs the API's `capacityRemaining`).

export interface ResourceLabels {
  singular: string;
  plural: string;
  capacityUnit: string;
  actionVerb: string;
}

export interface ResourceType {
  id: string;
  name: string;
  labels: ResourceLabels;
  allowsMultipleSeats: boolean;
  allowsWaitlist: boolean;
}

export interface AvailabilitySlot {
  id: string;
  resourceId: string;
  resourceName: string;
  resourceTypeId: string;
  locationName: string;
  startsAt: string;
  endsAt: string;
  capacityRemaining: number;
  rowVersion: number;
}

export interface Booking {
  id: string;
  availabilitySlotId: string;
  userId: string;
  seats: number;
  status: string;
  code: string;
  idempotencyKey: string;
  createdAt: string;
}

/** One pre-calculated "next best" slot returned in a 409 body — see ConflictSheet. */
export interface BookingAlternative {
  slotId: string;
  resourceName: string;
  startsAt: string;
  seatsLeft: number;
  distanceNote: string;
}

export interface BookingConflict {
  message: string;
  availabilitySlotId: string;
  alternatives: BookingAlternative[];
}

export interface ResourceDetail {
  id: string;
  resourceTypeId: string;
  resourceTypeName: string;
  labels: ResourceLabels;
  locationId: string;
  locationName: string;
  name: string;
  capacity: number;
  description: string | null;
  upcomingSlots: AvailabilitySlot[];
}

export interface WaitlistEntry {
  id: string;
  availabilitySlotId: string;
  userId: string;
  createdAt: string;
  /** 1-indexed place in line. */
  position: number;
}

/** GET /waitlist — flattened for the "Reservas" screen's waitlist section. */
export interface WaitlistEntryDetail {
  id: string;
  availabilitySlotId: string;
  resourceName: string;
  locationName: string;
  startsAt: string;
  endsAt: string;
  position: number;
}

export type BookingScope = "upcoming" | "past";

export interface MyBooking {
  id: string;
  availabilitySlotId: string;
  resourceId: string;
  resourceName: string;
  locationName: string;
  startsAt: string;
  endsAt: string;
  seats: number;
  status: string;
  code: string;
}

/**
 * GET /availability envelope. `emptyContext` is populated only when `slots`
 * is empty — enough for the client to compose a useful empty state.
 */
export interface AvailabilityResponse {
  slots: AvailabilitySlot[];
  emptyContext: EmptyContext | null;
}

export interface EmptyContext {
  /** "noAvailability" | "noResults" | "filtered" */
  reason: string;
  nextAvailableAt: string | null;
  blockingFilter: string | null;
  occupancyNote: string | null;
}

export interface BookingStreak {
  weeks: number;
}
