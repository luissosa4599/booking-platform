import type { EmptyContext } from "@/lib/api/types";

interface EmptyCopy {
  title: string;
  body: string;
}

function formatNextAvailable(iso: string): string {
  const when = new Date(iso);
  const now = new Date();
  const time = when.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const dayDiff = Math.round(
    (new Date(when).setHours(0, 0, 0, 0) - startOfToday.getTime()) / 86_400_000,
  );

  if (dayDiff <= 0) return `Hoy a las ${time} se libera un lugar.`;
  if (dayDiff === 1) return `Mañana a las ${time} hay lugar.`;
  const weekday = when.toLocaleDateString("es-MX", { weekday: "short", day: "numeric" });
  return `El ${weekday} a las ${time} hay lugar.`;
}

/**
 * Composes the ExploreScreen empty-state copy from the backend's `emptyContext`
 * (design-handoff screen 06: "el título nombra la causa concreta, el cuerpo da
 * el dato que resuelve"). The backend sends ASCII tokens; the accented Spanish
 * sentence is built here.
 */
export function composeEmptyStateCopy(ctx: EmptyContext | null): EmptyCopy {
  if (!ctx) {
    return {
      title: "Nada libre por ahora",
      body: "No hay espacios disponibles en este momento. Vuelve a intentar más tarde.",
    };
  }

  const next = ctx.nextAvailableAt ? formatNextAvailable(ctx.nextAvailableAt) : null;

  switch (ctx.reason) {
    case "noResults":
      return {
        title: "Sin coincidencias",
        body: ctx.blockingFilter
          ? `No encontramos espacios que coincidan con “${ctx.blockingFilter}”.`
          : "No encontramos espacios con esa búsqueda.",
      };

    case "filtered":
      return {
        title: "Nada con este filtro",
        body:
          next ??
          "Ningún espacio libre ahora cumple con este filtro. Prueba quitarlo.",
      };

    case "noAvailability":
    default:
      return {
        title: next ? "Todo ocupado ahora" : "Nada libre por ahora",
        body:
          [ctx.occupancyNote, next].filter(Boolean).join(" ") ||
          "No hay espacios disponibles en este momento.",
      };
  }
}
