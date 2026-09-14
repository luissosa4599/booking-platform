import { Text, View } from "react-native";

import { Button } from "@/components/Button";
import { QrCode } from "@/lib/icons";
import type { MyBooking } from "@/lib/api/types";
import { useColor } from "@/lib/theme/useColor";

function bannerTimeLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const time = date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return `hoy ${time}`;
  const weekday = date.toLocaleDateString("es-MX", { weekday: "long" });
  return `${weekday} ${time}`;
}

interface NextBookingBannerProps {
  /** null → renders nothing. No empty-state illustration — handoff §README. */
  booking: MyBooking | null;
  onOpenPass: () => void;
}

// Redesign handoff §5/§7.1 — "el único contenido con prioridad sobre la
// búsqueda cuando existe." The QR graphic is decorative (no pass number
// rendered here) — BookingPassSheet (opened by "Ver pase") has the real one.
export function NextBookingBanner({ booking, onOpenPass }: NextBookingBannerProps) {
  const onTintColor = useColor("on-tint");

  if (!booking) return null;

  return (
    <View
      className="flex-row items-center justify-between rounded-[22px] bg-tint"
      style={{ paddingVertical: 16, paddingHorizontal: 18 }}
    >
      <View className="flex-1 gap-2 pr-3.5">
        <Text className="text-footnote text-on-tint-sub" numberOfLines={1}>
          Tu próxima reserva · {bannerTimeLabel(booking.startsAt)}
        </Text>
        <Text className="text-body-emph text-on-tint" numberOfLines={1}>
          {booking.resourceName}
        </Text>
        <View style={{ alignSelf: "flex-start" }}>
          <Button variant="pill" tone="on-tint" onPress={onOpenPass}>
            Ver pase
          </Button>
        </View>
      </View>
      <QrCode size={62} strokeWidth={1.5} color={onTintColor} />
    </View>
  );
}
