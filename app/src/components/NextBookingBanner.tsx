import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { QrCode, X } from "@/lib/icons";
import type { MyBooking } from "@/lib/api/types";
import { useNextBookingBannerStore } from "@/lib/nextBookingBannerStore";
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
  // Inline, not `text-on-tint-sub` — confirmed via a stylesheet-rule scan
  // that the class generates NO CSS rule at all (unlike `text-on-tint`,
  // which does), so the subtitle fell through to the browser's default
  // black text on the orange banner (2026-09-14 report: "el texto negro
  // en la card naranja").
  const onTintSubColor = useColor("on-tint-sub");
  // The tache's own surface + glyph — same "card surface floating on the
  // tint banner" language `Button`'s `tone="on-tint"` already uses for "Ver
  // pase" (bg `card`, glyph `tint`), not the unrelated placeholder palette
  // from the positioning handoff's HTML mock (see below).
  const closeBgColor = useColor("card");
  const closeIconColor = useColor("tint");

  // Persistent dismiss (2026-09-17 report) — keyed by booking id, not a
  // plain "seen" flag: dismissing this reservation's banner shouldn't also
  // hide a *different* future reservation's banner once this one is past.
  // Self-hydrating on mount, same pattern as OfflineNotice/offlineNoticeStore.
  const hydrated = useNextBookingBannerStore((s) => s.hydrated);
  const dismissedBookingId = useNextBookingBannerStore((s) => s.dismissedBookingId);
  const hydrate = useNextBookingBannerStore((s) => s.hydrate);
  const dismiss = useNextBookingBannerStore((s) => s.dismiss);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // Nothing to show yet while hydrating — avoids a flash of the banner for
  // an already-dismissed booking right after app start, before the persisted
  // value has loaded.
  if (!booking || !hydrated || booking.id === dismissedBookingId) return null;

  return (
    // Positioning handoff (~/Downloads/"Posicionamiento del tache en card",
    // opción 1c, 2026-09-17): the tache used to squeeze into the card's own
    // flex row next to the QR — that's exactly what this handoff calls out
    // as the visual collision it exists to fix. Fix: the tache is now a
    // sibling of the card, absolutely positioned against *this* wrapper
    // (`position: relative`), floating outside both edges — not a flex
    // child competing for space inside the card. This wrapper must never
    // gain `overflow: "hidden"` or the -10/-10 offset gets clipped (the
    // handoff's own implementation note).
    <View style={{ position: "relative" }}>
      <View
        className="flex-row items-center justify-between bg-tint"
        // Inline, not `rounded-[22px]` — confirmed via getComputedStyle that
        // the class generated no border-radius at all (0px), same class of
        // NativeWind arbitrary-value gotcha as elsewhere in this project
        // (2026-09-14 report: "le falta redondeado").
        style={{ paddingVertical: 16, paddingHorizontal: 18, borderRadius: 22 }}
      >
        <View className="flex-1 gap-2 pr-3.5">
          <Text className="text-footnote" style={{ color: onTintSubColor }} numberOfLines={1}>
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
        {/* Decorative only (no real pass data here — see the file comment) —
            full-opacity `on-tint` read as a heavy, "unconvincing" dark shape
            in dark mode (2026-09-14 report: #40200B on the peach `tint`).
            Half-opacity turns it into a soft accent instead of competing with
            the real content, in both themes. */}
        <View style={{ opacity: 0.5 }}>
          <QrCode size={62} strokeWidth={1.5} color={onTintColor} />
        </View>
      </View>

      <Pressable
        onPress={() => dismiss(booking.id)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Descartar aviso de próxima reserva"
        style={{
          position: "absolute",
          top: -10,
          right: -10,
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: closeBgColor,
          shadowColor: "#0B0B0C",
          shadowOpacity: 0.28,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
          elevation: 4,
        }}
      >
        <X size={15} strokeWidth={2} color={closeIconColor} />
      </Pressable>
    </View>
  );
}
