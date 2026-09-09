import { QueryClient } from "@tanstack/react-query";

// `wireConnectivity()` (NetInfo / window online events -> onlineManager) is
// called from _layout.tsx's effect, not here — it touches `window`, which
// isn't defined during Metro's web SSR pass.

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Keep results long enough to survive an app restart offline; serve the
      // cache while offline. Per-hook `staleTime` overrides are unchanged.
      gcTime: 1000 * 60 * 60 * 24,
      networkMode: "offlineFirst",
      retry: 2,
    },
    // Mutations keep the default `networkMode: "online"` — an offline mutation
    // is *paused* (onMutate still runs, so the favorites toggle stays optimistic)
    // and fires when connectivity returns.
  },
});
