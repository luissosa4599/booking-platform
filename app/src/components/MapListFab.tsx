import { Pressable, Text } from "react-native";

import { haptics } from "@/lib/haptics";
import { List, Map as MapIcon } from "@/lib/icons";
import { useColor } from "@/lib/theme/useColor";

interface MapListFabProps {
  view: "list" | "map";
  onToggle: () => void;
  /** Distance from the bottom (tab bar height + the spec's 14px gap). */
  bottomOffset: number;
}

// Fits "Lista" (the longer of the two labels) + icon + padding comfortably;
// applied to both states so the pill never resizes when the label swaps
// (2026-09-14 report: "manten el mismo ancho para mapa y lista").
const FAB_WIDTH = 120;

// Redesign handoff §5/§3.1 — replaces the inline segmented Lista/Mapa control
// on phone width only; desktop keeps the SegmentedControl (no FAB there — see
// 07-desktop.md §"Mapa en escritorio"). The label names the destination
// ("Mapa" while viewing the list), not the current view.
//
// Theme-reactive now, but NOT conditioned on `view` — dark pill/white text
// in light mode, white pill/dark text in dark mode, the same regardless of
// which label is showing (2026-09-14 report: "consistencia en el tema del
// toggle... y en dark que sea blanco el boton"). Same `label-1`/`canvas`
// pairing `Button`'s `dark` variant already uses for this exact purpose —
// `label-1` is near-black in light and flips to white in dark, `canvas` is
// its inverse.
export function MapListFab({ view, onToggle, bottomOffset }: MapListFabProps) {
  const bg = useColor("label-1");
  const fg = useColor("canvas");
  const Icon = view === "list" ? MapIcon : List;
  const label = view === "list" ? "Mapa" : "Lista";

  return (
    <Pressable
      onPress={() => {
        haptics.selection();
        onToggle();
      }}
      accessibilityRole="button"
      accessibilityLabel={view === "list" ? "Ver en el mapa" : "Ver como lista"}
      style={{
        position: "absolute",
        bottom: bottomOffset,
        alignSelf: "center",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        width: FAB_WIDTH,
        height: 44,
        borderRadius: 9999,
        backgroundColor: bg,
        shadowColor: "#0B0B0C",
        shadowOpacity: 0.25,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 10 },
        elevation: 6,
      }}
    >
      <Icon size={16} color={fg} />
      <Text style={{ color: fg, fontSize: 15, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}
