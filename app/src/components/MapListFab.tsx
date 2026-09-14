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

// Redesign handoff §5/§3.1 — replaces the inline segmented Lista/Mapa control
// on phone width only; desktop keeps the SegmentedControl (no FAB there — see
// 07-desktop.md §"Mapa en escritorio"). The label names the destination
// ("Mapa" while viewing the list), not the current view.
export function MapListFab({ view, onToggle, bottomOffset }: MapListFabProps) {
  const fg = useColor(view === "list" ? "on-tint" : "label-1");
  const bg = useColor(view === "list" ? "label-1" : "card");
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
