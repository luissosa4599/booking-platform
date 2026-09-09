// Free-to-use Unsplash photos (Unsplash License — no attribution required, no
// API key). Keyed loosely by the resource type's internal name so an "Auditorio"
// and a "Cubiculo de estudio" don't show the same picture. These are NOT photos
// of the real place — they're stand-ins for the hero until real photography
// exists. The dev seeder (api/Infrastructure/Seed/DevSeeder.cs) attaches its own
// per-type photo pools directly as ResourceImage rows; this fallback only shows
// for a host-published space that has no photos yet.
const BY_TYPE: Record<string, string> = {
  Auditorio: "https://images.unsplash.com/photo-1519452575417-564c1401ecc0",
  Salon: "https://images.unsplash.com/photo-1580582932707-520aed937b7b",
  "Sala de lectura":
    "https://images.unsplash.com/photo-1568667256549-094345857637",
  "Cubiculo de estudio":
    "https://images.unsplash.com/photo-1434030216411-0b793f4b4173",
  // Legacy type names (pre-2026-09-09 seeder) — harmless to keep as aliases.
  "Sala de estudio":
    "https://images.unsplash.com/photo-1521587760476-6c12a4b040da",
  "Espacio individual":
    "https://images.unsplash.com/photo-1497633762265-9d179a990aa6",
};

const FALLBACK = "https://images.unsplash.com/photo-1481627834876-b7833e8f5570";

export function stockImageUrl(
  resourceTypeName: string | undefined,
  { width, height }: { width: number; height: number },
): string {
  const base = (resourceTypeName && BY_TYPE[resourceTypeName]) || FALLBACK;
  const w = Math.round(width);
  const h = Math.round(height);
  return `${base}?auto=format&fit=crop&w=${w}&h=${h}&q=70`;
}
