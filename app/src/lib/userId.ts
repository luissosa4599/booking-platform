import * as Crypto from "expo-crypto";

/**
 * No auth system exists yet (see api's Booking.UserId — "placeholder simple
 * por ahora"). One random id per app session, not persisted across restarts.
 * Replace with the real signed-in user id once SignInScreen exists.
 */
export const demoUserId = Crypto.randomUUID();
