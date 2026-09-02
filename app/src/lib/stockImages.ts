// Free-to-use Unsplash photos (Unsplash License — no attribution required, no
// API key). Generic library / study-space interiors, keyed loosely by the
// resource type's internal name so a "Sala de estudio" and an "Espacio
// individual" don't show the same picture. These are NOT photos of the real
// place — they're stand-ins for the hero until real photography exists.
const BY_TYPE: Record<string, string> = {
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
