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
  /** Straight-line metres from the device — only when sort=nearest. */
  distanceMeters?: number | null;
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
  locationAddress: string | null;
  locationLatitude: number | null;
  locationLongitude: number | null;
  name: string;
  capacity: number;
  description: string | null;
  /** Ordered host-uploaded photo URLs (empty until PR3b lands uploads). */
  photos?: string[];
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
  resourceId: string;
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
  /** Set once a host confirmed the visit. */
  checkedInAt: string | null;
}

/**
 * POST /checkins — one shape for every outcome. `status`:
 * confirmed | already_confirmed | queued (offline) | unknown_code | wrong_space | out_of_window
 */
export interface CheckinResult {
  status: string;
  bookingId?: string | null;
  code?: string | null;
  visitorName?: string | null;
  spaceName?: string | null;
  locationName?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  seats?: number | null;
  confirmedAt?: string | null;
  /** "future" | "past" for out_of_window */
  direction?: string | null;
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

// --- Host / owner ---------------------------------------------------------

export interface OwnerSpaceSummary {
  id: string;
  name: string;
  locationName: string;
  locationAddress: string | null;
  upcomingSlotCount: number;
  hasSchedule: boolean;
}

export interface OwnerSlot {
  id: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  booked: number;
  isBlocked: boolean;
  /** "Schedule" | "Adhoc" */
  origin: string;
}

export interface WeeklyScheduleDay {
  /** "Monday" … "Sunday" */
  weekday: string;
  /** "HH:mm" */
  openTime: string;
  closeTime: string;
  enabled: boolean;
}

export interface WeeklySchedule {
  slotDurationMinutes: number;
  capacity: number;
  days: WeeklyScheduleDay[];
}

export interface OwnerSpaceDetail {
  id: string;
  name: string;
  description: string | null;
  capacity: number;
  resourceTypeId: string;
  resourceTypeName: string;
  labels: ResourceLabels;
  allowsMultipleSeats: boolean;
  locationId: string;
  locationName: string;
  locationAddress: string | null;
  locationLatitude: number | null;
  locationLongitude: number | null;
  timeZone: string;
  /** Ordered host-uploaded photos (with ids, for reorder/delete). */
  images: ResourceImage[];
  schedule: WeeklySchedule | null;
  upcomingSlots: OwnerSlot[];
}

export interface CreateSpaceInput {
  name: string;
  description?: string | null;
  capacity: number;
  resourceTypeId: string;
  locationName: string;
  address?: string | null;
  timeZone: string;
  locationLatitude?: number | null;
  locationLongitude?: number | null;
}

export interface UpdateSpaceInput {
  name: string;
  description?: string | null;
  capacity: number;
  address?: string | null;
  locationLatitude?: number | null;
  locationLongitude?: number | null;
}

export interface SetScheduleInput {
  slotDurationMinutes: number;
  capacity: number;
  days: WeeklyScheduleDay[];
}

/** One row of GET/POST/DELETE/PUT /owner/spaces/{id}/images. */
export interface ResourceImage {
  id: string;
  url: string;
  position: number;
}

/** GET /me — the signed-in account plus the two counters the profile shows. */
export interface Me {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  /** "guest" | "host" */
  role: string;
  bookingCount: number;
  streakWeeks: number;
  createdAt: string;
}
