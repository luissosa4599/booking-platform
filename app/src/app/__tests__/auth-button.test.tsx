import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
// css-interop skips wrapping the core components when NODE_ENV is "test";
// registering them makes Pressable go through the same path as on a phone.
import "react-native-css-interop/dist/runtime/components";

import { AuthButton } from "../../components/auth/AuthButton";
import { palette } from "../../lib/theme/palette";

// The sign-in buttons shipped in vc15 with no background, border or centring
// on Android: NativeWind's native runtime drops a Pressable `style` given as a
// function, so the whole style object never reached the view (web was fine).
function buttonStyle(label: string) {
  return StyleSheet.flatten(screen.getByRole("button", { name: label }).props.style);
}

test("secondary button keeps its surface, border and centring on native", async () => {
  await render(<AuthButton variant="secondary" label="Continuar con correo" onPress={() => {}} />);

  const style = buttonStyle("Continuar con correo");
  expect(style.backgroundColor).toBe(palette("light").card);
  expect(style.borderWidth).toBe(1);
  expect(style.alignItems).toBe("center");
  expect(style.height).toBeGreaterThan(0);
});

test("primary button is tint-filled and darkens while pressed", async () => {
  await render(<AuthButton variant="primary" label="Entrar" onPress={() => {}} />);

  expect(buttonStyle("Entrar").backgroundColor).toBe(palette("light").tint);

  await fireEvent(screen.getByRole("button", { name: "Entrar" }), "pressIn");
  expect(buttonStyle("Entrar").backgroundColor).toBe(palette("light")["tint-press"]);

  await fireEvent(screen.getByRole("button", { name: "Entrar" }), "pressOut");
  expect(buttonStyle("Entrar").backgroundColor).toBe(palette("light").tint);
});
