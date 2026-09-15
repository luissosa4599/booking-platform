import type { AppNotification } from "@/lib/api/notifications";

/**
 * Composes the accented Spanish sentence for one notification from the
 * backend's ASCII `type` + snapshotted `resourceName`/`slotStartsAt` — same
 * "backend stays ASCII, frontend owns copy" split as
 * `lib/emptyStateCopy.ts`. Never derives from a live booking/slot lookup:
 * the snapshot is what makes this correct even after the underlying
 * booking is cancelled or the slot is gone.
 */
export function notificationCopy(n: AppNotification): string {
  const place = n.resourceName ?? "tu espacio";
  const time = n.slotStartsAt
    ? new Date(n.slotStartsAt).toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  switch (n.type) {
    case "reminder":
      // No trailing period when `time` is appended — es-MX's "a.m."/"p.m."
      // already ends in one (confirmed live: "empieza a las 12:00 p.m.."
      // double-period otherwise).
      return time
        ? `Tu reserva en ${place} empieza a las ${time}`
        : `Tu reserva en ${place} empieza pronto.`;
    case "waitlist_slot_opened":
      return `Se liberó un lugar en ${place} — ya puedes reservarlo.`;
    case "booking_cancelled_by_host":
      return `El anfitrión cerró tu horario en ${place}. Busca otro disponible.`;
    default:
      return `Actualización sobre ${place}.`;
  }
}
