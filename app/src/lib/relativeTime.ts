/** "actualizado hace 3 min" / "hace 2 h" / "ayer". */
export function formatUpdatedAgo(timestampMs: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - timestampMs) / 1000));
  if (seconds < 60) return "actualizado hace un momento";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `actualizado hace ${minutes} min`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `actualizado hace ${hours} h`;

  const days = Math.round(hours / 24);
  if (days === 1) return "actualizado ayer";
  return `actualizado hace ${days} días`;
}
