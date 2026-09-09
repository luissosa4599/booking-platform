import { apiFetch } from "./client";

/**
 * Reverse-geocode via the backend proxy (`GET /geocode/reverse`). Returns null
 * on any failure or when the server has no Geocoding key configured — the
 * caller keeps whatever address the user typed.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<string | null> {
  try {
    const res = await apiFetch<{ address: string | null }>(
      `/geocode/reverse?lat=${lat}&lng=${lng}`,
    );
    return res.address ?? null;
  } catch {
    return null;
  }
}
