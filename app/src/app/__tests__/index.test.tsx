import { render } from "@testing-library/react-native";

import Index from "../index";

test("renders the placeholder screen without crashing", async () => {
  const { getByText } = await render(<Index />);

  expect(getByText("booking-engine scaffold")).toBeTruthy();
});
