import { Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";

import { Button } from "@/components/Button";
import { useOwnerSpace } from "@/lib/api/owner";
import { X } from "@/lib/icons";
import { useUserId } from "@/lib/session";
import { useColor } from "@/lib/theme/useColor";

function slotLabel(iso: string) {
  const d = new Date(iso);
  const day = d.toLocaleDateString("es-MX", { weekday: "short", day: "numeric" });
  const time = d.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${day} · ${time}`;
}

interface SpacePaneProps {
  id: string;
  onClose: () => void;
}

/**
 * The desktop detail pane for host "Mis espacios" (PR #11 follow-up) — the same
 * master–detail pattern Explore/Bookings use. A read-only summary of the
 * selected space beside the still-live list; "Abrir" / "Editar" go to the full
 * screens where slots are actually managed. Fixed 380px, its own scroll.
 */
export function SpacePane({ id, onClose }: SpacePaneProps) {
  const router = useRouter();
  const userId = useUserId();
  const { data: space, isLoading } = useOwnerSpace(id, userId);
  const closeColor = useColor("label-3");

  const heroUrl = space?.images?.[0]?.url ?? null;

  const openDays = space?.schedule?.days.filter((d) => d.enabled).length ?? 0;
  const slots = space?.upcomingSlots ?? [];

  return (
    <View
      className="border-l border-hairline bg-card"
      style={{ width: 380, flexShrink: 0, alignSelf: "stretch" }}
    >
      <View className="flex-row items-start justify-between px-5 pt-5">
        <Text numberOfLines={2} className="flex-1 pr-3 text-title-sm text-label-1">
          {space?.name ?? (isLoading ? "…" : "")}
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
        {space ? (
          <>
            <View className="gap-1">
              <Text className="text-footnote text-label-3">
                {space.locationName}
                {space.locationAddress ? ` · ${space.locationAddress}` : ""}
              </Text>
              <Text className="text-subhead text-label-3">
                {space.capacity} {space.labels.capacityUnit}
              </Text>
            </View>

            {heroUrl ? (
              <Image
                source={{ uri: heroUrl }}
                style={{ width: "100%", height: 150, borderRadius: 14 }}
                contentFit="cover"
                transition={120}
              />
            ) : null}

            {space.description ? (
              <Text className="text-subhead text-label-3">
                {space.description}
              </Text>
            ) : null}

            <View className="gap-1">
              <Text className="text-footnote font-semibold uppercase text-label-4">
                Horario semanal
              </Text>
              <Text className="text-subhead text-label-2">
                {space.schedule
                  ? `${openDays} ${openDays === 1 ? "día" : "días"} · bloques de ${space.schedule.slotDurationMinutes} min`
                  : "Sin horario definido"}
              </Text>
            </View>

            <View className="gap-1">
              <Text className="text-footnote font-semibold uppercase text-label-4">
                Próximos horarios · {slots.length}
              </Text>
              {slots.length > 0 ? (
                <View>
                  {slots.slice(0, 6).map((slot) => {
                    const full = slot.booked >= slot.capacity;
                    return (
                      <View
                        key={slot.id}
                        className="flex-row items-center justify-between border-b border-hairline-inset py-2.5"
                      >
                        <Text
                          className="text-subhead text-label-1"
                          style={{ fontVariant: ["tabular-nums"] }}
                        >
                          {slotLabel(slot.startsAt)}
                        </Text>
                        <Text
                          className={
                            slot.isBlocked || full
                              ? "text-footnote text-label-4"
                              : "text-footnote text-label-3"
                          }
                        >
                          {slot.isBlocked
                            ? "Bloqueado"
                            : full
                              ? "Lleno"
                              : `${slot.capacity - slot.booked}/${slot.capacity}`}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text className="text-subhead text-label-3">
                  Aún no hay horarios próximos.
                </Text>
              )}
            </View>

            <View className="gap-2 pt-1">
              <Button
                variant="filled"
                onPress={() => router.push(`/(owner)/space/${id}`)}
              >
                Abrir
              </Button>
              <Button
                variant="gray"
                onPress={() => router.push(`/(owner)/space/${id}/edit`)}
              >
                Editar
              </Button>
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
