import { Text } from "react-native";

import { formatUpdatedAgo } from "@/lib/relativeTime";
import { useIsOffline } from "@/lib/net";

/**
 * A small caption shown while offline, telling the viewer the data on screen is
 * cached and how old it is. Renders nothing when online.
 */
export function StaleStamp({
  dataUpdatedAt,
  className = "pl-1 text-footnote text-label-4",
}: {
  /** `query.dataUpdatedAt` (ms). 0 -> nothing to stamp. */
  dataUpdatedAt: number;
  className?: string;
}) {
  const offline = useIsOffline();
  if (!offline || !dataUpdatedAt) return null;

  return <Text className={className}>{formatUpdatedAgo(dataUpdatedAt)}</Text>;
}
