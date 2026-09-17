import { Platform, Text, type TextStyle } from "react-native";

interface BookingDayHeaderProps {
  label: string;
}

// Reservas handoff §2.4 — day (Reservas) or month (Anteriores) group header.
// 12px/600/uppercase/0.08em/label-4 — not the 13px `footnote` token, a
// distinct one-off size. "En listas largas debe quedar sticky bajo el bloque
// de pestañas": real CSS position:sticky, web-only (Platform.OS check) —
// there's no SectionList (or any sticky-header) precedent anywhere in this
// app, and this project's own convention is "web-verified, native
// code-review-only" for exactly this kind of platform-specific polish.
// Native degrades to a normal in-flow header — declared deviation, see the
// plan.
export function BookingDayHeader({ label }: BookingDayHeaderProps) {
  const stickyStyle: TextStyle | undefined =
    Platform.OS === "web"
      ? ({ position: "sticky", top: 0, zIndex: 1 } as unknown as TextStyle)
      : undefined;

  return (
    <Text
      className="bg-canvas py-1 pl-1 uppercase text-label-4"
      style={[{ fontSize: 12, fontWeight: "600", letterSpacing: 0.96 }, stickyStyle]}
    >
      {label}
    </Text>
  );
}
