import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Row } from "@/components/Row";
import { Sheet } from "@/components/Sheet";
import { haptics } from "@/lib/haptics";
import { Check, Moon } from "@/lib/icons";
import { useThemeStore, type ThemePreference } from "@/lib/theme/themeStore";
import { useColor } from "@/lib/theme/useColor";

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "Igual que el sistema" },
  { value: "light", label: "Claro" },
  { value: "dark", label: "Oscuro" },
];

const SHORT: Record<ThemePreference, string> = {
  system: "Sistema",
  light: "Claro",
  dark: "Oscuro",
};

// Replaces the old "Tema oscuro" on/off `Toggle` (2026-09-18 report) — that
// switch only ever wrote an explicit "dark"/"light" `ThemePreference`, so
// touching it once permanently dropped "system" with no way back to it from
// the UI, even though `themeStore`'s default and `ThemeProvider`'s OS-follow
// behavior both already existed. Same Sheet-with-radio-options pattern as
// `SortControl` (a `Row` trigger here instead of a pill, since this lives
// inside the Ajustes `Group`, not a filter bar).
export function ThemeControl() {
  const [open, setOpen] = useState(false);
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);
  const checkColor = useColor("tint");
  // Inline, not a `text-tint-press` className — themeable tokens resolve to
  // nothing inside a Sheet on web (DOM portal, outside ThemeProvider's
  // `vars()` scope) — same gotcha `SortControl` already documents.
  const selectedLabelColor = useColor("tint-press");
  const labelColor = useColor("label-1");

  return (
    <>
      <Row
        icon={Moon}
        title="Tema"
        trailing="chevron"
        trailingText={SHORT[preference]}
        onPress={() => {
          haptics.selection();
          setOpen(true);
        }}
      />
      <Sheet isOpen={open} onClose={() => setOpen(false)}>
        <View className="gap-1">
          <Text className="mb-2 text-title-sm text-label-1">Tema</Text>
          {OPTIONS.map((opt) => {
            const selected = opt.value === preference;
            return (
              <Pressable
                key={opt.value}
                onPress={() => {
                  haptics.selection();
                  setOpen(false);
                  if (opt.value !== preference) setPreference(opt.value);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                className="min-h-[52px] flex-row items-center gap-3 py-2"
              >
                <View className="flex-1">
                  <Text
                    className="text-body-emph"
                    style={{ color: selected ? selectedLabelColor : labelColor }}
                  >
                    {opt.label}
                  </Text>
                </View>
                {selected ? (
                  <Check size={18} strokeWidth={3} color={checkColor} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </>
  );
}
