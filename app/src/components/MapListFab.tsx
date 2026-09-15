import { Pressable, Text } from "react-native";

import { haptics } from "@/lib/haptics";
import { List, Map as MapIcon } from "@/lib/icons";

interface MapListFabProps {
  view: "list" | "map";
  onToggle: () => void;
  /** Distance from the bottom (tab bar height + the spec's 14px gap). */
  bottomOffset: number;
}

// Redesign handoff §5/§3.1 — replaces the inline segmented Lista/Mapa control
// on phone width only; desktop keeps the SegmentedControl (no FAB there — see
// 07-desktop.md §"Mapa en escritorio"). The label names the destination
// ("Mapa" while viewing the list), not the current view.
//
// Fixed dark pill + white text/icon, literal hex — NOT `useColor`/theme
// tokens, and NOT conditioned on `view` (2026-09-14 report: "consistencia
// en el tema del toggle, uno lo veo negro y otro blanco" — the previous
// version flipped bg/fg based on which label was showing, e.g. black-on-
// white for "Lista" but white-on-black for "Mapa" in light mode). Every
// reference screenshot shows this pill as the same solid dark shape
// regardless of state or app theme — same "always dark regardless of the
// app's own theme" convention `Toast` already uses (CLAUDE.md, "bg-label-1
// is the wrong choice for an always-dark surface").
const FAB_BG = "#1C1C1E";
const FAB_FG = "#FFFFFF";

export function MapListFab({ view, onToggle, bottomOffset }: MapListFabProps) {
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
        gap: 8,
        height: 44,
        paddingHorizontal: 20,
        borderRadius: 9999,
        backgroundColor: FAB_BG,
        shadowColor: "#0B0B0C",
        shadowOpacity: 0.25,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 10 },
        elevation: 6,
      }}
    >
      <Icon size={16} color={FAB_FG} />
      <Text style={{ color: FAB_FG, fontSize: 15, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}
