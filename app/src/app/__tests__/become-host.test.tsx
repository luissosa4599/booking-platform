import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import BecomeHostScreen from "../become-host";
import { useAuthStore, type Session } from "../../lib/session";

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

jest.mock("expo-crypto", () => ({ randomUUID: () => "test-uuid" }));
jest.mock("@gorhom/bottom-sheet");
jest.mock("lucide-react-native");

const GUEST_SESSION: Session = {
  userId: "user-1",
  email: "luis@uni.mx",
  displayName: "Luis Sosa",
  avatarUrl: null,
  role: "guest",
  accessToken: "access",
  refreshToken: "refresh",
};

const HOST_SESSION_RESPONSE = {
  accessToken: "new-access",
  refreshToken: "new-refresh",
  accessTokenExpiresAt: new Date(Date.now() + 1_800_000).toISOString(),
  user: {
    id: "user-1",
    email: "luis@uni.mx",
    displayName: "Luis Sosa",
    avatarUrl: null,
    role: "host",
  },
};

let queryClient: QueryClient;

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  useAuthStore.setState({ hydrated: true, session: GUEST_SESSION, viewMode: "guest" });
  globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/me/become-host")) {
      return { ok: true, status: 200, json: async () => HOST_SESSION_RESPONSE } as Response;
    }
    throw new Error(`Unhandled fetch in test: ${url}`);
  }) as unknown as typeof fetch;
});

afterEach(() => {
  queryClient.clear();
  jest.clearAllMocks();
});

test("upgrading flips the session role and opens the success sheet", async () => {
  const { getByText } = await render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <QueryClientProvider client={queryClient}>
        <BecomeHostScreen />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );

  fireEvent.press(getByText("Convertirme en anfitrión"));

  await waitFor(() => {
    expect(useAuthStore.getState().session?.role).toBe("host");
    expect(useAuthStore.getState().viewMode).toBe("host");
    expect(getByText("Ya eres anfitrión")).toBeTruthy();
  });
});
