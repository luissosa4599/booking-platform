import { render, screen } from "@testing-library/react-native";
import { StyleSheet, type StyleProp, type TextStyle } from "react-native";
// css-interop skips wrapping the core components when NODE_ENV is "test";
// registering them makes styles go through the same path as on a phone.
import "react-native-css-interop/dist/runtime/components";

import { Avatar } from "../../components/Avatar";
import { Pill } from "../../components/Pill";
import { palette } from "../../lib/theme/palette";

// On native NativeWind assigns the inline style over the className styles,
// undefined keys included — a colour left to a className next to an inline
// `color: undefined` came out black (vc15: the inactive Reservas pill was
// black-on-black in dark mode). These colours must be inline in both states.
const light = palette("light");

function flat(element: { props: { style?: unknown } }): TextStyle {
  return StyleSheet.flatten(element.props.style as StyleProp<TextStyle>) ?? {};
}

test("inactive Pill keeps its card fill and label colour", async () => {
  await render(<Pill active={false} label="Próximas" onPress={() => {}} />);

  expect(flat(screen.getByRole("tab", { name: "Próximas" })).backgroundColor).toBe(light.card);
  expect(flat(screen.getByText("Próximas")).color).toBe(light["label-2"]);
});

test("active Pill is tint with on-tint text", async () => {
  await render(<Pill active label="Anteriores" onPress={() => {}} />);

  expect(flat(screen.getByRole("tab", { name: "Anteriores" })).backgroundColor).toBe(light.tint);
  expect(flat(screen.getByText("Anteriores")).color).toBe(light["on-tint"]);
});

test("wash Avatar keeps its tint-wash circle and tint initials", async () => {
  await render(<Avatar name="Luis Sosa" />);

  const initials = screen.getByText("LS");
  expect(flat(initials).color).toBe(light.tint);
  expect(closestBackground(initials)).toBe(light["tint-wash"]);
});

// The circle is the nearest ancestor that paints a background.
function closestBackground(element: { parent: unknown; props: { style?: unknown } } | null) {
  for (let node = element; node; node = node.parent as typeof element) {
    const bg = flat(node).backgroundColor;
    if (bg) return bg;
  }
  return undefined;
}
