import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import type { Query } from "@tanstack/react-query";

// Only these query domains are written to disk — enough for the offline read
// experience (bookings, resource detail, availability, favorites, profile).
// Owner/waitlist/etc. stay memory-only.
export const PERSISTED_KEYS = new Set([
  "bookings",
  "resource",
  "availability",
  "resource-types",
  "me",
  "favorites",
]);

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "tempo.querycache.v1",
  throttleTime: 1000,
});

export const persistOptions = {
  persister,
  maxAge: 1000 * 60 * 60 * 24, // 24h
  buster: "v1",
  dehydrateOptions: {
    shouldDehydrateQuery: (query: Query) =>
      query.state.status === "success" &&
      PERSISTED_KEYS.has(query.queryKey?.[0] as string),
  },
};
