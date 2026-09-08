import { useState } from "react";
import { Platform, Text, View } from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";

import { Button } from "@/components/Button";
import { Group } from "@/components/Group";
import { Row } from "@/components/Row";
import { Sheet } from "@/components/Sheet";
import { Stepper } from "@/components/Stepper";

export interface NewSlotInput {
  startsAt: string;
  endsAt: string;
  capacity: number;
}

interface SlotSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (input: NewSlotInput) => void;
  busy?: boolean;
  defaultCapacity?: number;
}

type PickerField = "date" | "start" | "end";

// Handoff H — "Agregar horario". Fecha / Inicio / Fin open native pickers; the
// Sheet retains its own state so re-opening starts fresh.
export function SlotSheet({
  isOpen,
  onClose,
  onAdd,
  busy = false,
  defaultCapacity = 4,
}: SlotSheetProps) {
  const [date, setDate] = useState(() => tomorrowAt(10));
  const [start, setStart] = useState(() => atTime(10, 0));
  const [end, setEnd] = useState(() => atTime(11, 30));
  const [capacity, setCapacity] = useState(defaultCapacity);
  const [picker, setPicker] = useState<PickerField | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startAt = combine(date, start);
  const endAt = combine(date, end);
  const valid = endAt > startAt && startAt > new Date();

  function onPick(event: DateTimePickerEvent, picked?: Date) {
    const field = picker;
    setPicker(null);
    if (event.type === "dismissed" || !picked || !field) return;
    if (field === "date") setDate(picked);
    if (field === "start") setStart(picked);
    if (field === "end") setEnd(picked);
  }

  function submit() {
    if (!valid) {
      setError("Revisa que el fin sea despues del inicio y la fecha en el futuro.");
      return;
    }
    setError(null);
    onAdd({
      startsAt: startAt.toISOString(),
      endsAt: endAt.toISOString(),
      capacity,
    });
  }

  return (
    <Sheet isOpen={isOpen} onClose={onClose}>
      <View className="gap-5">
        <Text className="text-title-sm text-label-1">Agregar horario</Text>

        <Group variant="canvas">
          <Row
            title="Fecha"
            trailing="text"
            trailingText={date.toLocaleDateString("es-MX", {
              weekday: "short",
              day: "numeric",
              month: "short",
            })}
            onPress={() => setPicker("date")}
          />
          <Row
            title="Inicio"
            trailing="text"
            trailingText={fmtTime(start)}
            onPress={() => setPicker("start")}
          />
          <Row
            title="Fin"
            trailing="text"
            trailingText={fmtTime(end)}
            onPress={() => setPicker("end")}
          />
          <View className="flex-row items-center justify-between px-4 py-3">
            <Text className="text-body text-label-1">Lugares</Text>
            <Stepper value={capacity} min={1} max={60} onChange={setCapacity} />
          </View>
        </Group>

        {error ? (
          <Text className="text-center text-footnote text-state-error">{error}</Text>
        ) : null}

        <Button variant="filled" loading={busy} onPress={submit}>
          Agregar
        </Button>
      </View>

      {picker ? (
        <DateTimePicker
          mode={picker === "date" ? "date" : "time"}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          is24Hour
          value={picker === "date" ? date : picker === "start" ? start : end}
          minimumDate={picker === "date" ? new Date() : undefined}
          onChange={onPick}
        />
      ) : null}
    </Sheet>
  );
}

function tomorrowAt(hour: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, 0, 0, 0);
  return d;
}
function atTime(hour: number, minute: number): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}
function combine(date: Date, time: Date): Date {
  const d = new Date(date);
  d.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return d;
}
function fmtTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
