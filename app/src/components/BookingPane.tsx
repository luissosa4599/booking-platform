import { Pressable, ScrollView, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

import { Button } from "@/components/Button";
import { StatusBadge } from "@/components/StatusBadge";
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

interface BookingPaneProps {
  booking: MyBooking;
  scope: BookingScope;
  onClose: () => void;
  onCancel: (booking: MyBooking) => void;
  onRepeat: (booking: MyBooking) => void;
}

/**
 * The desktop detail pane for Bookings (PR #11 follow-up) — the same
 * master–detail pattern Explore uses. The pass **and its QR live in the pane**,
 * not the `BookingPassSheet` (which stays the phone/tablet path). Fixed 380px,
 * its own scroll.
 */
export function BookingPane({
  booking,
  scope,
  onClose,
  onCancel,
  onRepeat,
}: BookingPaneProps) {
  const closeColor = useColor("label-3");

  const cancelled = booking.status === "Cancelled";
  const confirmed = !!booking.checkedInAt;
  const showPass = !cancelled;

  return (
    <View
      className="border-l border-hairline bg-card"
      style={{ width: 380, flexShrink: 0, alignSelf: "stretch" }}
    >
      <View className="flex-row items-start justify-between px-5 pt-5">
        <Text numberOfLines={2} className="flex-1 pr-3 text-title-sm text-label-1">
          {booking.resourceName}
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
        contentContainerStyle={{ padding: 20, paddingTop: 12, gap: 16 }}
      >
        <View className="gap-1">
          <Text className="text-footnote text-label-3">
            {booking.locationName}
          </Text>
          <Text
            className="text-body text-label-1"
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {formatSchedule(booking.startsAt, booking.endsAt)}
          </Text>
          <Text className="text-subhead text-label-3">
            {booking.seats} {booking.seats === 1 ? "persona" : "personas"}
          </Text>
        </View>

        {confirmed ? (
          <StatusBadge
            tone="free"
            label={`Visita confirmada · ${timeOfDay(booking.checkedInAt!)}`}
          />
        ) : null}

        {cancelled ? (
          <Text className="text-subhead text-label-3">
            Esta reserva fue cancelada.
          </Text>
        ) : null}

        {showPass ? (
          <View className="items-center gap-4 pt-1">
            {/* The QR sits on its own white tile so it scans in either theme —
                react-native-qrcode-svg needs literal colors, not classNames. */}
            <View
              className="rounded-[18px] bg-white p-4"
              style={{ opacity: confirmed ? 0.35 : 1 }}
            >
              <QRCode
                value={booking.code || "—"}
                size={168}
                backgroundColor="#FFFFFF"
                color="#0B0B0C"
              />
            </View>
            <Text
              className="text-label-1"
              style={{
                fontSize: 32,
                fontWeight: "700",
                fontVariant: ["tabular-nums"],
                opacity: confirmed ? 0.45 : 1,
              }}
            >
              {booking.code || "—"}
            </Text>
            {confirmed ? (
              <Text className="text-center text-footnote text-label-4">
                El anfitrión ya validó tu llegada.
              </Text>
            ) : null}
          </View>
        ) : null}

        {scope === "upcoming" && !cancelled ? (
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
