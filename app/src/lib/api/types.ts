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
  idempotencyKey: string;
  createdAt: string;
}

export interface BookingConflict {
  message: string;
  availabilitySlotId: string;
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
}
