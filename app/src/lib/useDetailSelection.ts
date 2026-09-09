import { router, useLocalSearchParams } from "expo-router";

/**
 * The desktop master–detail selection (PR #11). The list writes `?sel=<id>` to
 * the URL with `setParams` — no navigation, so the list screen stays mounted
 * and keeps refreshing while the detail pane shows the selected item. Back /
 * forward and a shared link still work.
 *
 * Only meaningful at `desktop` (`useHasDetailPane()`); the list decides whether
 * to call `select` or `router.push` a full screen.
 */
export function useDetailSelection() {
  const params = useLocalSearchParams<{ sel?: string }>();
  const selectedId = typeof params.sel === "string" ? params.sel : null;
  return {
    selectedId,
    select: (id: string) => router.setParams({ sel: id }),
    clear: () => router.setParams({ sel: undefined }),
  };
}
