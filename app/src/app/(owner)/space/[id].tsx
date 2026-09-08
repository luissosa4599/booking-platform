import { Fragment } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Button } from "@/components/Button";
import { Group } from "@/components/Group";
import { Row } from "@/components/Row";
import { Screen } from "@/components/Screen";
import { useOwnerSpace } from "@/lib/api/owner";
import type { WeeklySchedule } from "@/lib/api/types";
import { ArrowLeft } from "@/lib/icons";
import { useUserId } from "@/lib/session";
import { useColor } from "@/lib/theme/useColor";

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_ES: Record<string, string> = {
  Monday: "Lun",
  Tuesday: "Mar",
  Wednesday: "Mié",
  Thursday: "Jue",
  Friday: "Vie",
  Saturday: "Sáb",
  Sunday: "Dom",
};

export default function HostSpaceScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId();
  const backColor = useColor("label-1");
  const { data: space, isLoading } = useOwnerSpace(id ?? "", userId);

  return (
    <Screen bg="card" edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="flex-row items-center justify-between px-4 pt-2">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Volver"
            className="h-9 w-9 items-center justify-center rounded-full bg-fill"
          >
            <ArrowLeft size={18} color={backColor} />
          </Pressable>
          <Pressable
            onPress={() => router.push(`/(owner)/space/${id}/edit`)}
            accessibilityRole="button"
          >
            <Text className="text-body text-tint">Editar espacio</Text>
          </Pressable>
        </View>

        {isLoading || !space ? (
          <Text className="px-4 pt-6 text-body text-label-3">Cargando…</Text>
        ) : (
          <View className="gap-6 px-4 pt-4">
            <View className="gap-1">
              <Text className="text-title-md text-label-1">{space.name}</Text>
              <Text className="text-body text-label-3">
                {space.locationName}
                {space.locationAddress ? ` · ${space.locationAddress}` : ""} ·{" "}
                {space.capacity} {space.labels.capacityUnit}
              </Text>
              {space.description ? (
                <Text className="text-subhead text-label-3">{space.description}</Text>
              ) : null}
            </View>

            {/* Weekly schedule */}
            <View className="gap-2">
              <View className="flex-row items-center justify-between pl-1">
                <Text className="text-footnote font-semibold uppercase text-label-4">
                  Horario semanal
                </Text>
                <Pressable
                  onPress={() => router.push(`/(owner)/space/${id}/schedule`)}
                  accessibilityRole="button"
                >
                  <Text className="text-subhead text-tint">Editar</Text>
                </Pressable>
              </View>
              <Group>{scheduleRows(space.schedule)}</Group>
            </View>

            {/* Upcoming slots */}
            <View className="gap-2">
              <Text className="pl-1 text-footnote font-semibold uppercase text-label-4">
                Próximos horarios
              </Text>
              {space.upcomingSlots.length === 0 ? (
                <Group>
                  <Row
                    title="Aún no hay horarios"
                    subtitle="Edita el horario semanal para generarlos"
                  />
                </Group>
              ) : (
                <Group>
                  {space.upcomingSlots.slice(0, 20).map((slot) => {
                    const start = new Date(slot.startsAt);
                    const full = slot.booked >= slot.capacity;
                    return (
                      <Row
                        key={slot.id}
                        title={formatSlot(start)}
                        tabularTitle
                        meta={
                          full
                            ? "Lleno"
                            : `${slot.capacity - slot.booked}/${slot.capacity} lugares`
                        }
                        metaTone={full ? "last" : "default"}
                      />
                    );
                  })}
                </Group>
              )}
            </View>

            <View className="pt-2">
              <Button
                variant="filled"
                onPress={() => router.replace("/spaces")}
              >
                Ver mis espacios
              </Button>
            </View>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function scheduleRows(schedule: WeeklySchedule | null) {
  if (!schedule) {
    return (
      <Row
        title="Sin horario"
        subtitle="Define días y horas para empezar a recibir reservas"
      />
    );
  }

  const byDay = new Map(schedule.days.map((d) => [d.weekday, d]));
  const rows = DAY_ORDER.map((weekday) => {
    const d = byDay.get(weekday);
    const open = d?.enabled ?? false;
    return {
      weekday,
      label: DAY_ES[weekday] ?? weekday,
      text: open ? `${d!.openTime} – ${d!.closeTime}` : "Cerrado",
      open,
    };
  });

  return (
    <>
      {rows.map((r, i) => (
        <Fragment key={r.weekday}>
          <View className="flex-row items-center justify-between px-4 py-[11px]">
            <Text className="text-body text-label-1">{r.label}</Text>
            <Text
              className={r.open ? "text-body text-label-2" : "text-body text-label-4"}
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {r.text}
            </Text>
          </View>
          {i < rows.length - 1 ? <View className="ml-4 h-px bg-hairline" /> : null}
        </Fragment>
      ))}
      <View className="ml-4 h-px bg-hairline" />
      <View className="px-4 py-[11px]">
        <Text className="text-subhead text-label-3">
          Bloques de {schedule.slotDurationMinutes} min · {schedule.capacity} lugares
        </Text>
      </View>
    </>
  );
}

function formatSlot(date: Date): string {
  const day = date.toLocaleDateString("es-MX", { weekday: "short", day: "numeric" });
  const time = date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  return `${day} · ${time}`;
}
