import { cloneElement, isValidElement, type ReactNode } from "react";
import { Text, View } from "react-native";

import { Button, type ButtonVariant } from "@/components/Button";
import { useColor } from "@/lib/theme/useColor";

// The handoff's own 4 values (noAvailability/noResults/filtered/offline)
// only cover ExploreScreen's filtered-results empty state — "no bookings
// yet" and "no history yet" are a different case the handoff doesn't
// enumerate. Added here rather than reusing "noResults" for telemetry that
// would otherwise mislabel these.
export type PlaceholderReason =
  | "noAvailability"
  | "noResults"
  | "filtered"
  | "offline"
  | "noBookings"
  | "noHistory";

interface PlaceholderAction {
  label: string;
  onPress: () => void;
}

interface PlaceholderProps {
  icon: ReactNode;
  title: string;
  body: string;
  primaryAction: PlaceholderAction;
  secondaryAction?: PlaceholderAction;
  /** For telemetry — not rendered. */
  reason: PlaceholderReason;
}

const PRIMARY_VARIANT: ButtonVariant = "filled";
const SECONDARY_VARIANT: ButtonVariant = "plain";

export function Placeholder({
  icon,
  title,
  body,
  primaryAction,
  secondaryAction,
}: PlaceholderProps) {
  const chevron = useColor("chevron");

  return (
    <View className="items-center gap-[14px] px-10">
      <View className="mb-[6px] h-16 w-16 items-center justify-center rounded-[18px] bg-fill text-chevron">
        {isValidElement<{ color?: string }>(icon)
          ? cloneElement(icon, { color: icon.props.color ?? chevron })
          : icon}
      </View>

      <Text className="text-title-sm text-center text-label-1">{title}</Text>
      <Text className="text-body text-label-3 text-center" numberOfLines={3}>
        {body}
      </Text>

      <View className="w-full gap-2 pt-[14px]">
        <Button variant={PRIMARY_VARIANT} onPress={primaryAction.onPress}>
          {primaryAction.label}
        </Button>
        {secondaryAction ? (
          <Button variant={SECONDARY_VARIANT} onPress={secondaryAction.onPress}>
            {secondaryAction.label}
          </Button>
        ) : null}
      </View>
    </View>
  );
}
