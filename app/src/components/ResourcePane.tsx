import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";

import { Button } from "@/components/Button";
import { useResource } from "@/lib/api/resources";
import type { AvailabilitySlot } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { haptics } from "@/lib/haptics";
import { MapPin, X } from "@/lib/icons";
import { directionsUrl } from "@/lib/maps";
import { stockImageUrl } from "@/lib/stockImages";
import { useColor } from "@/lib/theme/useColor";

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface ResourcePaneProps {
  id: string;
  onClose: () => void;
  onBook: (slot: AvailabilitySlot) => void;
  pendingSlotIds: Set<string>;
}

/**
 * The desktop detail pane (PR #11) — a compact view of the selected resource
 * beside the still-live Explore list. Not the full `resource/[id]` screen; the
 * "Abrir" button opens that for the considered flow. Fixed 380px, its own
 * scroll.
 */
export function ResourcePane({
  id,
  onClose,
  onBook,
  pendingSlotIds,
}: ResourcePaneProps) {
  const router = useRouter();
  const { data: resource, isLoading } = useResource(id);
  const closeColor = useColor("label-3");
  const pinColor = useColor("label-3");

  const actionVerb = resource?.labels.actionVerb ?? "Apartar";

  const slots = (resource?.upcomingSlots ?? []).filter(
    (s) => s.capacityRemaining > 0,
  );
  const heroUrl =
    resource?.photos?.[0] ??
    stockImageUrl(resource?.resourceTypeName, { width: 720, height: 300 });

  const coords =
    resource?.locationLatitude != null && resource?.locationLongitude != null
      ? { lat: resource.locationLatitude, lng: resource.locationLongitude }
      : null;

  return (
    <View
      className="border-l border-hairline bg-card"
      style={{ width: 380, flexShrink: 0, alignSelf: "stretch" }}
    >
      <View className="flex-row items-start justify-between px-5 pt-5">
        <Text
          numberOfLines={2}
          className="flex-1 pr-3 text-title-sm text-label-1"
        >
          {resource?.name ?? (isLoading ? "…" : "")}
        </Text>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          hitSlop={8}
          className="rounded-full bg-fill p-1.5"
        >
          <X size={16} color={closeColor} />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingTop: 12, gap: 14 }}
      >
        {resource?.locationName ? (
          <Pressable
            onPress={
              coords || resource.locationAddress
                ? () =>
                    Linking.openURL(
                      directionsUrl(
                        coords ?? { address: resource.locationAddress! },
                      ),
                    )
                : undefined
            }
            className="flex-row items-center gap-1"
          >
            <MapPin size={13} color={pinColor} />
            <Text className="text-footnote text-label-3">
              {resource.locationName}
            </Text>
          </Pressable>
        ) : null}

        <Image
          source={{ uri: heroUrl }}
          style={{ width: "100%", height: 150, borderRadius: 14 }}
          contentFit="cover"
          transition={120}
        />

        {resource?.description ? (
          <Text className="text-subhead text-label-3">
            {resource.description}
          </Text>
        ) : null}

        {slots.length > 0 ? (
          <View className="gap-1">
            {slots.slice(0, 6).map((slot) => {
              const pending = pendingSlotIds.has(slot.id);
              return (
                <View
                  key={slot.id}
                  className="flex-row items-center justify-between border-b border-hairline-inset py-3"
                >
                  <Text
                    className="text-body text-label-1"
                    style={{ fontVariant: ["tabular-nums"] }}
                  >
                    {timeLabel(slot.startsAt)} – {timeLabel(slot.endsAt)}
                  </Text>
                  <Pressable
                    onPress={() => {
                      haptics.selection();
                      onBook(slot);
                    }}
                    disabled={pending}
                    accessibilityRole="button"
                    accessibilityLabel={`${actionVerb} ${timeLabel(slot.startsAt)}`}
                    className={cn(
                      "rounded-full bg-tint-wash px-3.5 py-1.5",
                      pending && "opacity-50",
                    )}
                  >
                    <Text className="text-footnote font-semibold text-tint-press">
                      {pending ? "…" : actionVerb}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : (
          <Text className="text-subhead text-label-3">
            Sin horarios libres hoy.
          </Text>
        )}

        <Button
          variant="gray"
          onPress={() =>
            router.push({
              pathname: "/resource/[id]",
              params: {
                id,
                name: resource?.name ?? "",
                location: resource?.locationName ?? "",
              },
            })
          }
        >
          Abrir
        </Button>
      </ScrollView>
    </View>
  );
}
