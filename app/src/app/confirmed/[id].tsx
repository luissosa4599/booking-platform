import { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Button } from "@/components/Button";
import { Group } from "@/components/Group";
import { Screen } from "@/components/Screen";
import { SuccessCheckmark } from "@/components/SuccessCheckmark";
import { useBookingStreak } from "@/lib/api/bookings";
import { addBookingToCalendar, copyBookingDetails } from "@/lib/calendar";
import { haptics } from "@/lib/haptics";
import { MapPin } from "@/lib/icons";
import { directionsUrl } from "@/lib/maps";
import { useUserId } from "@/lib/session";
import { useColor } from "@/lib/theme/useColor";

const ORDINALS = [
  "",
  "Primera",
  "Segunda",
  "Tercera",
  "Cuarta",
  "Quinta",
  "Sexta",
  "Séptima",
  "Octava",
  "Novena",
  "Décima",
  "Undécima",
  "Duodécima",
];

function streakLine(weeks: number): string {
  const ordinal = ORDINALS[weeks] ?? `${weeks}.ª`;
  return `${ordinal} semana seguida. Bien.`;
}

function formatWhen(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const dayDiff = Math.round(
    (new Date(start).setHours(0, 0, 0, 0) - startOfToday.getTime()) /
      86_400_000,
  );

  const day =
    dayDiff === 0
      ? "Hoy"
      : dayDiff === 1
        ? "Mañana"
        : start.toLocaleDateString("es-MX", {
            weekday: "long",
            day: "numeric",
          });
  const t = (d: Date) =>
    d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });

  return `${day} ${t(start)} – ${t(end)}`;
}

function SummaryRow({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <View className="flex-row items-center justify-between px-4 py-3">
      <Text className="text-body text-label-3">{label}</Text>
      <Text
        className={
          emphasis ? "text-body-emph text-label-1" : "text-body text-label-1"
        }
        style={{ fontVariant: ["tabular-nums"] }}
      >
        {value}
      </Text>
    </View>
  );
}

export default function ConfirmedScreen() {
  const router = useRouter();
  const {
    code = "",
    name = "Tu reserva",
    location = "",
    locationAddress = "",
    locationLat,
    locationLng,
    startsAt = "",
    endsAt = "",
    seats = "1",
    unit = "personas",
  } = useLocalSearchParams<{
    id: string;
    code?: string;
    name?: string;
    location?: string;
    locationAddress?: string;
    locationLat?: string;
    locationLng?: string;
    startsAt?: string;
    endsAt?: string;
    seats?: string;
    unit?: string;
  }>();

  const mapPinColor = useColor("label-3");
  const lat = locationLat ? Number(locationLat) : null;
  const lng = locationLng ? Number(locationLng) : null;
  const directions =
    lat != null && lng != null
      ? directionsUrl({ lat, lng })
      : locationAddress
        ? directionsUrl({ address: locationAddress })
        : null;
  function openDirections() {
    if (!directions) return;
    haptics.selection();
    void Linking.openURL(directions);
  }

  const streakQuery = useBookingStreak(useUserId());
  const weeks = streakQuery.data?.weeks ?? 0;

  // "add" → offer the calendar; "copy" → the calendar was unavailable/denied,
  // so per the handoff the button silently becomes "Copiar detalles".
  const [calMode, setCalMode] = useState<"add" | "copy">("add");
  const [calDone, setCalDone] = useState(false);
  const [calBusy, setCalBusy] = useState(false);

  const calendarEvent = {
    title: name,
    startsAt,
    endsAt,
    location: location || undefined,
    notes: code ? `Código: ${code}` : undefined,
  };

  async function handleCalendar() {
    setCalBusy(true);
    const outcome =
      calMode === "add"
        ? await addBookingToCalendar(calendarEvent)
        : await copyBookingDetails(calendarEvent);
    setCalBusy(false);

    if (outcome === "added") {
      setCalDone(true);
    } else if (outcome === "copied") {
      setCalMode("copy");
      setCalDone(true);
    } else {
      setCalMode("copy");
    }
  }

  const calLabel = calDone
    ? calMode === "add"
      ? "Añadido al calendario"
      : "Detalles copiados"
    : calMode === "add"
      ? "Añadir al calendario"
      : "Copiar detalles";

  return (
    <Screen bg="card" edges={["top", "bottom"]}>
      <View className="flex-1 justify-center gap-8 px-6">
        <View className="items-center gap-8">
          <SuccessCheckmark />
          <View className="items-center gap-2">
            <Text className="text-title-md text-label-1">Es tuya</Text>
            <Text className="text-body text-center text-label-3">
              Te avisamos 30 minutos antes.
            </Text>
          </View>
        </View>

        <View className="gap-3">
          <View className="gap-[3px] px-1">
            <Text className="text-title-sm text-label-1">{name}</Text>
            {location ? (
              <Text className="text-body text-label-3">{location}</Text>
            ) : null}
            {locationAddress ? (
              <Pressable
                onPress={directions ? openDirections : undefined}
                disabled={!directions}
                hitSlop={4}
                accessibilityRole={directions ? "button" : undefined}
                accessibilityLabel={
                  directions
                    ? `${locationAddress}, ver en Google Maps`
                    : undefined
                }
                className="flex-row items-center gap-1 pt-px"
              >
                <MapPin size={13} color={mapPinColor} />
                <Text className="text-footnote text-label-3">
                  {locationAddress}
                </Text>
              </Pressable>
            ) : null}
          </View>

          <Group variant="canvas">
            <SummaryRow
              label="Cuándo"
              value={startsAt && endsAt ? formatWhen(startsAt, endsAt) : "—"}
            />
            <SummaryRow label={capitalize(unit)} value={seats} />
            <SummaryRow label="Código" value={code || "—"} emphasis />
          </Group>

          {weeks >= 3 ? (
            <Text className="px-1 text-subhead text-label-4">
              {streakLine(weeks)}
            </Text>
          ) : null}
        </View>
      </View>

      <View className="gap-2 px-6 pb-4">
        <Button
          variant="filled"
          loading={calBusy}
          disabled={calDone}
          onPress={handleCalendar}
        >
          {calLabel}
        </Button>
        <Button variant="gray" onPress={() => router.replace("/bookings")}>
          Ver reservación
        </Button>
        <Button variant="plain" onPress={() => router.replace("/")}>
          Listo
        </Button>
      </View>
    </Screen>
  );
}

function capitalize(value: string) {
  return value.length > 0 ? value[0].toUpperCase() + value.slice(1) : value;
}
