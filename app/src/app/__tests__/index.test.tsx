import { render } from "@testing-library/react-native";

import Index from "../index";

test("renders the placeholder screen without crashing", async () => {
  const { getByText } = await render(<Index />);

  expect(getByText("Sala Boreal 204")).toBeTruthy();
  expect(getByText("Apartar 14:00")).toBeTruthy();
});
