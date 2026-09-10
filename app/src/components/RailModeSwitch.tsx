import { Text, View } from "react-native";

import { Toggle } from "@/components/Toggle";
import { useAuthStore, useRole, useViewMode } from "@/lib/session";
import { useBreakpoint } from "@/lib/useBreakpoint";

/**
 * The "Modo anfitrión" switch that sits at the foot of the {@link NavRail} — the
 * same control ProfileContent shows as a row, lifted here so a host can flip
 * between the guest and host nav groups without opening the profile. Renders
 * nothing for a plain guest (they get "Publica tu espacio" in the profile
 * instead). Collapsed rail (`tablet`) shows just the switch, no label.
 */
export function RailModeSwitch() {
  const bp = useBreakpoint();
  const role = useRole();
  const viewMode = useViewMode();
  const setViewMode = useAuthStore((s) => s.setViewMode);

  if (role !== "host") {
    return null;
  }

  const expanded = bp === "desktop";

  return (
    <View
      className="mt-2 border-t border-hairline-inset pt-3"
      style={{ paddingHorizontal: expanded ? 10 : 0 }}
    >
      <View
        className={
          expanded
            ? "flex-row items-center justify-between gap-2"
            : "items-center"
        }
      >
        {expanded ? (
          <Text className="flex-1 text-footnote text-label-3">
            Modo anfitrión
          </Text>
        ) : null}
        <Toggle
          value={viewMode === "host"}
          onChange={(v) => setViewMode(v ? "host" : "guest")}
          accessibilityLabel="Modo anfitrión"
        />
      </View>
    </View>
  );
}
