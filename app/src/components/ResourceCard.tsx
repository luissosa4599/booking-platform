import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { HeartButton } from "@/components/HeartButton";
import { StatusBadge, type StatusTone } from "@/components/StatusBadge";
import { cn } from "@/lib/cn";
import { Clock } from "@/lib/icons";
import { useColor } from "@/lib/theme/useColor";

export interface ResourceCardProps {
  /** `variant="stacked"` (phone): photo on top, badges over it, CTA in the
   * footer. `variant="row"` (desktop master column): 92px thumbnail with a
   * status dot, text in the middle, heart + CTA on the right. */
  variant: "stacked" | "row";
  name: string;
  imageUri: string;
  locationName: string;
  /** Already abbreviated (e.g. "48"), no "lugares" word — list convention. */
  capacityLabel: string;
  statusTone: StatusTone;
  statusLabel: string;
  /** "hasta 02:31 p.m." or "01:01 p.m. – 02:31 p.m." — already formatted. */
  timeLabel: string;
  distanceLabel?: string | null;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onBook: () => void;
  onPress: () => void;
  bookLoading?: boolean;
  /** Row variant only — the master column highlights the selected resource. */
  selected?: boolean;
  actionLabel?: string;
  actionAccessibilityLabel?: string;
}

export function ResourceCard(props: ResourceCardProps) {
  return props.variant === "stacked" ? (
    <StackedCard {...props} />
  ) : (
    <RowCard {...props} />
  );
}

function metaLine(locationName: string, capacityLabel: string, distanceLabel?: string | null) {
  return distanceLabel
    ? `${locationName} · ${capacityLabel} · a ${distanceLabel}`
    : `${locationName} · ${capacityLabel}`;
}

function StackedCard({
  name,
  imageUri,
  locationName,
  capacityLabel,
  statusTone,
  statusLabel,
  timeLabel,
  distanceLabel,
  isFavorite,
  onToggleFavorite,
  onBook,
  onPress,
  bookLoading,
  actionLabel = "Apartar",
  actionAccessibilityLabel,
}: ResourceCardProps) {
  const clockColor = useColor("label-3");

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={`${name}, ${locationName}, ${statusLabel}`}
      className="overflow-hidden rounded-group border border-hairline bg-card"
    >
      <View style={{ height: 150 }}>
        <Image
          source={{ uri: imageUri }}
          style={{ width: "100%", height: 150 }}
          contentFit="cover"
          transition={120}
        />
        <View style={{ position: "absolute", left: 12, top: 12 }}>
          <StatusBadge tone={statusTone} label={statusLabel} variant="onPhoto" />
        </View>
        <View style={{ position: "absolute", right: 12, top: 12 }}>
          <HeartButton variant="hero" active={isFavorite} onToggle={onToggleFavorite} />
        </View>
      </View>

      <View style={{ paddingTop: 14, paddingHorizontal: 16, paddingBottom: 16, gap: 10 }}>
        <Text numberOfLines={1} className="text-body-emph text-label-1">
          {name}
        </Text>
        <Text numberOfLines={1} className="text-footnote text-label-3">
          {metaLine(locationName, capacityLabel, distanceLabel)}
        </Text>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-1.5">
            <Clock size={14} strokeWidth={2} color={clockColor} />
            <Text className="text-footnote text-label-3">{timeLabel}</Text>
          </View>
          <Button
            variant="pill"
            tone="filled"
            loading={bookLoading}
            onPress={onBook}
            accessibilityLabel={actionAccessibilityLabel ?? actionLabel}
          >
            {actionLabel}
          </Button>
        </View>
      </View>
    </Pressable>
  );
}

function RowCard({
  name,
  imageUri,
  locationName,
  capacityLabel,
  statusTone,
  statusLabel,
  timeLabel,
  distanceLabel,
  isFavorite,
  onToggleFavorite,
  onBook,
  onPress,
  bookLoading,
  selected,
  actionLabel = "Apartar",
  actionAccessibilityLabel,
}: ResourceCardProps) {
  const dotColor = useColor(statusTone === "last" ? "state-last" : "state-free");
  const dotBorderColor = useColor("card");

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={`${name}, ${locationName}, ${statusLabel}`}
      className={cn(
        "flex-row items-center gap-[14px] rounded-[18px] border p-3",
        selected ? "border-[1.5px] border-tint bg-tint-wash" : "border-hairline bg-card",
      )}
    >
      <View style={{ width: 92, height: 92 }}>
        <Image
          source={{ uri: imageUri }}
          style={{ width: 92, height: 92, borderRadius: 14 }}
          contentFit="cover"
          transition={120}
        />
        <View
          style={{
            position: "absolute",
            left: 8,
            top: 8,
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: dotColor,
            borderWidth: 2,
            borderColor: dotBorderColor,
          }}
        />
      </View>

      <View className="flex-1 gap-1.5">
        <Text numberOfLines={1} className="text-body-emph text-label-1">
          {name}
        </Text>
        <Text numberOfLines={1} className="text-footnote text-label-3">
          {metaLine(locationName, capacityLabel, distanceLabel)}
        </Text>
        <Text numberOfLines={1} className="text-footnote">
          <Text
            className="font-semibold"
            style={{ color: dotColor }}
          >
            {statusLabel}
          </Text>
          <Text className="text-label-3"> · {timeLabel}</Text>
        </Text>
      </View>

      <View className="items-end gap-2.5">
        <HeartButton variant="inline" active={isFavorite} onToggle={onToggleFavorite} />
        <Button
          variant="pill"
          tone="wash"
          loading={bookLoading}
          onPress={onBook}
          accessibilityLabel={actionAccessibilityLabel ?? actionLabel}
        >
          {actionLabel}
        </Button>
      </View>
    </Pressable>
  );
}
