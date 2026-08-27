import * as Calendar from "expo-calendar";
import * as Clipboard from "expo-clipboard";
import { Platform } from "react-native";

export type CalendarOutcome = "added" | "copied" | "failed";

export interface BookingEventInput {
  title: string;
  startsAt: string;
  endsAt: string;
  location?: string;
  notes?: string;
}

function formatRange(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const date = start.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const t = (d: Date) =>
    d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  return `${date}, ${t(start)} – ${t(end)}`;
}

async function findWritableCalendarId(): Promise<string | null> {
  if (Platform.OS === "ios") {
    const def = await Calendar.getDefaultCalendarAsync();
    return def?.id ?? null;
  }
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const owned = calendars.find(
    (c) => c.allowsModifications && c.accessLevel === Calendar.CalendarAccessLevel.OWNER,
  );
  return (owned ?? calendars.find((c) => c.allowsModifications))?.id ?? null;
}

/**
 * Handoff § "04": "'Añadir al calendario' usa expo-calendar; si el permiso se
 * deniega, el botón pasa a 'Copiar detalles' sin mostrar alerta." So this never
 * throws or alerts — it returns what actually happened and the caller relabels.
 * On web (no Calendar API) it copies straight away.
 */
export async function addBookingToCalendar(
  event: BookingEventInput,
): Promise<CalendarOutcome> {
  if (Platform.OS !== "web") {
    try {
      const { granted } = await Calendar.requestCalendarPermissionsAsync();
      if (granted) {
        const calendarId = await findWritableCalendarId();
        if (calendarId) {
          await Calendar.createEventAsync(calendarId, {
            title: event.title,
            startDate: new Date(event.startsAt),
            endDate: new Date(event.endsAt),
            location: event.location,
            notes: event.notes,
          });
          return "added";
        }
      }
    } catch {
      // fall through to the clipboard fallback
    }
  }
  return copyBookingDetails(event);
}

export async function copyBookingDetails(
  event: BookingEventInput,
): Promise<CalendarOutcome> {
  try {
    const text = [
      event.title,
      formatRange(event.startsAt, event.endsAt),
      event.location,
      event.notes,
    ]
      .filter(Boolean)
      .join("\n");
    await Clipboard.setStringAsync(text);
    return "copied";
  } catch {
    return "failed";
  }
}
