import { Image } from "expo-image";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { QrPassTile } from "@/components/QrPassTile";
import type { BookingScope, MyBooking } from "@/lib/api/types";
import { haptics } from "@/lib/haptics";
import { X } from "@/lib/icons";
import { useColor } from "@/lib/theme/useColor";

function timeOfDay(iso: string) {
  return new Date(iso).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSchedule(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const isToday = start.toDateString() === new Date().toDateString();
  const dayLabel = isToday
    ? "Hoy"
    : start.toLocaleDateString("es-MX", { weekday: "short", day: "numeric" });
  return `${dayLabel} ${timeOfDay(startsAt)} – ${timeOfDay(endsAt)}`;
}

function formatFullDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatCountdown(startsAt: string): string | null {
  const diffMs = new Date(startsAt).getTime() - Date.now();
  if (diffMs <= 0) return null;
  const mins = Math.round(diffMs / 60_000);
  if (mins < 60) return `en ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `en ${h} h` : `en ${h} h ${m} min`;
}

interface BookingPaneProps {
  booking: MyBooking;
  scope: BookingScope;
  onClose: () => void;
  onCancel: (booking: MyBooking) => void;
  onRepeat: (booking: MyBooking) => void;
  /** "Ver pase completo" — opens the real BookingPassSheet (screen-brightness
   * + rotation-lock live there, this pane's own QR doesn't replace it). */
  onViewFullPass: (booking: MyBooking) => void;
}

/**
 * The desktop detail pane for Bookings — same master–detail pattern Explore
 * uses. Reservas handoff §2.8: status line, title+thumb, a 3-column metadata
 * table, and a tint-wash pass block with its own (smaller) QR — "Ver pase
 * completo" still opens the real `BookingPassSheet` for the
 * screen-brightness/rotation-lock behavior only a real modal can do. Fixed
 * 380px — declared deviation from the doc's implied 400px, for consistency
 * with `ResourcePane`/`SpacePane` (both also fixed at 380px).
 */
export function BookingPane({
  booking,
  scope,
  onClose,
  onCancel,
  onRepeat,
  onViewFullPass,
}: BookingPaneProps) {
  const closeColor = useColor("label-3");
  const stateFree = useColor("state-free");
  const stateError = useColor("state-error");
  const tintPress = useColor("tint-press");
  const tint = useColor("tint");

  const cancelled = booking.status === "Cancelled";
  const confirmed = !!booking.checkedInAt;
  const showPass = !cancelled;

  const status = cancelled
    ? { label: "Cancelada", color: stateError }
    : confirmed
      ? { label: `Visita confirmada · ${timeOfDay(booking.checkedInAt!)}`, color: stateFree }
      : {
          label: (() => {
            const countdown = formatCountdown(booking.startsAt);
            const dayLabel =
              new Date(booking.startsAt).toDateString() === new Date().toDateString()
                ? "hoy"
                : new Date(booking.startsAt).toLocaleDateString("es-MX", {
                    weekday: "short",
                    day: "numeric",
                  });
            return countdown ? `Confirmada · ${dayLabel}, ${countdown}` : `Confirmada · ${dayLabel}`;
          })(),
          color: stateFree,
        };

  return (
    <View
      className="border-l border-hairline bg-card"
      style={{ width: 380, flexShrink: 0, alignSelf: "stretch" }}
    >
      <View className="flex-row items-start justify-between px-5 pt-5">
        <Text className="pt-1 text-footnote text-label-3">Detalle de reserva</Text>
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
        contentContainerStyle={{ padding: 20, paddingTop: 8, gap: 22 }}
      >
        <View className="flex-row items-center gap-2">
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: status.color }} />
          <Text style={{ fontSize: 13, fontWeight: "600", color: status.color }}>{status.label}</Text>
        </View>

        <View className="flex-row items-start gap-4">
          <View className="flex-1 gap-1">
            <Text className="text-title-screen text-label-1">{booking.resourceName}</Text>
            <Text className="text-footnote text-label-3">{booking.locationName}</Text>
          </View>
          {booking.imageUrl ? (
            <Image
              source={{ uri: booking.imageUrl }}
              style={{ width: 96, height: 96, borderRadius: 16 }}
              contentFit="cover"
            />
          ) : null}
        </View>

        {/* 3-column metadata table — cells are `bg-card` on a `bg-hairline`
            parent with a 1px gap, so the parent's color shows through as the
            grid lines (same "background peeking through a gap" trick, just
            in 2 dimensions instead of Group's single divider line). */}
        {/* `rounded-card-compact` as a className generates no rule at all —
            same silent-no-op gotcha as elsewhere this session. Inline. */}
        <View
          className="flex-row overflow-hidden border border-hairline bg-hairline"
          style={{ gap: 1, borderRadius: 18 }}
        >
          <View className="gap-1 bg-card py-4" style={{ flex: 1.2, paddingHorizontal: 12 }}>
            <Text className="text-label-4" style={{ fontSize: 12, fontWeight: "600" }}>
              HORARIO
            </Text>
            <Text
              className="text-label-1"
              style={{ fontSize: 15, fontWeight: "600", fontVariant: ["tabular-nums"] }}
            >
              {timeOfDay(booking.startsAt)} – {timeOfDay(booking.endsAt)}
            </Text>
          </View>
          <View className="gap-1 bg-card py-4" style={{ flex: 1.25, paddingHorizontal: 12 }}>
            <Text className="text-label-4" style={{ fontSize: 12, fontWeight: "600" }}>
              FECHA
            </Text>
            <Text className="text-label-1" style={{ fontSize: 15, fontWeight: "600" }}>
              {formatFullDate(booking.startsAt)}
            </Text>
          </View>
          <View className="gap-1 bg-card py-4" style={{ flex: 0.9, paddingHorizontal: 12 }}>
            <Text className="text-label-4" style={{ fontSize: 12, fontWeight: "600" }}>
              PERSONAS
            </Text>
            <Text className="text-label-1" style={{ fontSize: 15, fontWeight: "600" }}>
              {booking.seats}
            </Text>
          </View>
        </View>

        {showPass ? (
          <View className="items-center gap-5 bg-tint-wash p-5" style={{ borderRadius: 18 }}>
            <QrPassTile code={booking.code} size={112} dimmed={confirmed} />
            <View className="items-center gap-1">
              <Text style={{ fontSize: 12, fontWeight: "600", color: tintPress }}>TU PASE</Text>
              <Text
                style={{
                  fontFamily: "SpaceGrotesk_700Bold",
                  fontSize: 28,
                  letterSpacing: 28 * 0.04,
                  color: tint,
                  opacity: confirmed ? 0.45 : 1,
                }}
              >
                {booking.code || "—"}
              </Text>
              <Text className="text-center" style={{ fontSize: 14, color: tintPress }}>
                {confirmed
                  ? "El anfitrión ya validó tu llegada."
                  : "Muestra el código en la entrada del edificio."}
              </Text>
            </View>
          </View>
        ) : null}

        {scope === "upcoming" && !cancelled ? (
          <View className="gap-2">
            <Button
              variant="filled"
              onPress={() => {
                haptics.selection();
                onViewFullPass(booking);
              }}
            >
              Ver pase completo
            </Button>
            <Button
              variant="gray"
              onPress={() => {
                haptics.selection();
                onCancel(booking);
              }}
              accessibilityLabel={`Cancelar reserva de ${booking.resourceName}, ${formatSchedule(booking.startsAt, booking.endsAt)}`}
            >
              Cancelar reserva
            </Button>
          </View>
        ) : null}

        {scope === "past" ? (
          <Button
            variant="gray"
            onPress={() => {
              haptics.selection();
              onRepeat(booking);
            }}
            accessibilityLabel={`Repetir reserva de ${booking.resourceName}`}
          >
            Repetir
          </Button>
        ) : null}
      </ScrollView>
    </View>
  );
}
