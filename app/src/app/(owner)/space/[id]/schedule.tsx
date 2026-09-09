import { useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Button } from "@/components/Button";
import { Group } from "@/components/Group";
import { Screen } from "@/components/Screen";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Stepper } from "@/components/Stepper";
import { Toggle } from "@/components/Toggle";
import { useOwnerSpace, useSetSchedule } from "@/lib/api/owner";
import type { WeeklyScheduleDay } from "@/lib/api/types";
import { ArrowLeft } from "@/lib/icons";
import { useIsOffline } from "@/lib/net";
import { useUserId } from "@/lib/session";
import { useColor } from "@/lib/theme/useColor";

const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;
const WEEKDAY_ES: Record<string, string> = {
  Monday: "Lun",
  Tuesday: "Mar",
  Wednesday: "Mié",
  Thursday: "Jue",
  Friday: "Vie",
  Saturday: "Sáb",
  Sunday: "Dom",
};
const HORIZON_DAYS = 14;

type DayState = { enabled: boolean; openTime: string; closeTime: string };

const DEFAULT_DAY: DayState = { enabled: false, openTime: "08:00", closeTime: "20:00" };

export default function WeeklyScheduleScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId();
  const offline = useIsOffline();
  const backColor = useColor("label-1");
  const { data: space } = useOwnerSpace(id ?? "", userId);
  const setSchedule = useSetSchedule(id ?? "");

  const [days, setDays] = useState<Record<string, DayState>>(() =>
    Object.fromEntries(WEEKDAYS.map((w) => [w, { ...DEFAULT_DAY }])),
  );
  const [duration, setDuration] = useState("90");
  const [capacity, setCapacity] = useState(4);
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState<
    { weekday: string; field: "openTime" | "closeTime" } | null
  >(null);

  // Guarded one-shot hydrate during render (useEffect trips
  // react-hooks/set-state-in-effect in this project's lint setup).
  const [hydrated, setHydrated] = useState(false);
  if (space?.schedule && !hydrated) {
    const next: Record<string, DayState> = Object.fromEntries(
      WEEKDAYS.map((w) => [w, { ...DEFAULT_DAY }]),
    );
    for (const d of space.schedule.days) {
      next[d.weekday] = {
        enabled: d.enabled,
        openTime: d.openTime,
        closeTime: d.closeTime,
      };
    }
    setDays(next);
    setDuration(String(space.schedule.slotDurationMinutes));
    setCapacity(space.schedule.capacity);
    setHydrated(true);
  }

  const estimatedSlots = useMemo(() => {
    const block = Number(duration);
    let perWeek = 0;
    for (const w of WEEKDAYS) {
      const d = days[w]!;
      if (!d.enabled) continue;
      const mins = toMinutes(d.closeTime) - toMinutes(d.openTime);
      if (mins > 0) perWeek += Math.floor(mins / block);
    }
    return Math.round((perWeek * HORIZON_DAYS) / 7);
  }, [days, duration]);

  async function save() {
    setError(null);
    const payload: WeeklyScheduleDay[] = WEEKDAYS.map((w) => ({
      weekday: w,
      openTime: days[w]!.openTime,
      closeTime: days[w]!.closeTime,
      enabled: days[w]!.enabled,
    }));
    try {
      await setSchedule.mutateAsync({
        slotDurationMinutes: Number(duration),
        capacity,
        days: payload,
      });
      router.back();
    } catch {
      setError("No pudimos guardar el horario. Revisa que la hora de apertura sea antes que la de cierre.");
    }
  }

  function onPickerChange(event: DateTimePickerEvent, date?: Date) {
    const current = picker;
    setPicker(null);
    if (event.type === "dismissed" || !date || !current) return;
    const value = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    setDays((prev) => ({
      ...prev,
      [current.weekday]: { ...prev[current.weekday]!, [current.field]: value },
    }));
  }

  return (
    <Screen bg="canvas" edges={["top", "bottom"]}>
      <View className="flex-row items-center gap-3 px-4 py-2">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          className="h-9 w-9 items-center justify-center rounded-full bg-fill"
        >
          <ArrowLeft size={18} color={backColor} />
        </Pressable>
        <Text className="text-body-emph text-label-1">Horario semanal</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 16 }}>
        <Group>
          {WEEKDAYS.map((w) => {
            const d = days[w]!;
            return (
              <View key={w} className="flex-row items-center gap-3 px-4 py-[11px]">
                <Text className="w-11 text-body text-label-1">{WEEKDAY_ES[w]}</Text>
                <View className="flex-1 flex-row items-center gap-2">
                  {d.enabled ? (
                    <>
                      <TimePill
                        label={d.openTime}
                        onPress={() => setPicker({ weekday: w, field: "openTime" })}
                      />
                      <Text className="text-subhead text-label-3">–</Text>
                      <TimePill
                        label={d.closeTime}
                        onPress={() => setPicker({ weekday: w, field: "closeTime" })}
                      />
                    </>
                  ) : (
                    <Text className="text-subhead text-label-4">Cerrado</Text>
                  )}
                </View>
                <Toggle
                  value={d.enabled}
                  accessibilityLabel={`${WEEKDAY_ES[w]} abierto`}
                  onChange={(v) =>
                    setDays((prev) => ({ ...prev, [w]: { ...prev[w]!, enabled: v } }))
                  }
                />
              </View>
            );
          })}
        </Group>

        <View className="gap-2">
          <Text className="pl-1 text-footnote font-semibold uppercase text-label-4">
            Duración del bloque
          </Text>
          <SegmentedControl
            options={[
              { label: "60 min", value: "60" },
              { label: "90 min", value: "90" },
              { label: "120 min", value: "120" },
            ]}
            value={duration}
            onChange={setDuration}
          />
        </View>

        <Group>
          <View className="flex-row items-center justify-between px-4 py-3">
            <Text className="text-body text-label-1">Capacidad por bloque</Text>
            <Stepper value={capacity} min={1} max={60} onChange={setCapacity} />
          </View>
        </Group>

        {error ? (
          <Text className="text-center text-footnote text-state-error">{error}</Text>
        ) : null}
      </ScrollView>

      <View className="gap-2 border-t border-hairline-inset bg-glass px-4 pb-3 pt-3">
        <Text className="text-center text-footnote text-label-4">
          Se generan ~{estimatedSlots} horarios para los próximos {HORIZON_DAYS} días.
        </Text>
        <Button
          variant="filled"
          disabled={offline}
          loading={setSchedule.isPending}
          onPress={save}
        >
          {offline ? "Sin conexión" : "Guardar horario"}
        </Button>
      </View>

      {picker ? (
        <DateTimePicker
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          is24Hour
          value={timeToDate(days[picker.weekday]![picker.field])}
          onChange={onPickerChange}
        />
      ) : null}
    </Screen>
  );
}

function TimePill({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="rounded-[10px] bg-fill px-3 py-[7px]"
    >
      <Text
        className="text-subhead text-label-1"
        style={{ fontVariant: ["tabular-nums"] }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function timeToDate(hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h ?? 8, m ?? 0, 0, 0);
  return d;
}
