import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ProfileContent } from "../../components/ProfileContent";
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

function mockFetch(handlers: Record<string, () => { status: number; body: unknown }>) {
  globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const match = Object.entries(handlers).find(([path]) => url.includes(path));
    if (!match) throw new Error(`Unhandled fetch in test: ${url}`);
    const { status, body } = match[1]();
    return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
  }) as unknown as typeof fetch;
}

let queryClient: QueryClient;

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  useAuthStore.setState({ hydrated: true, session: GUEST_SESSION, viewMode: "guest" });
});

afterEach(() => {
  queryClient.clear();
  jest.clearAllMocks();
});

function renderProfile(side: "guest" | "host" = "guest") {
  return render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <QueryClientProvider client={queryClient}>
        <ProfileContent side={side} />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}
// RNTL 14's render() is async.

test("renders identity and activity stats from /me", async () => {
  mockFetch({
    "/me": () => ({
      status: 200,
      body: {
        id: "user-1",
        email: "luis@uni.mx",
        displayName: "Luis Sosa",
        avatarUrl: null,
        role: "guest",
        bookingCount: 37,
        streakWeeks: 8,
        createdAt: new Date().toISOString(),
      },
    }),
  });

  const { getByText } = await renderProfile();

  await waitFor(() => {
    expect(getByText("Luis Sosa")).toBeTruthy();
    expect(getByText("luis@uni.mx")).toBeTruthy();
    expect(getByText("37")).toBeTruthy();
    expect(getByText("8")).toBeTruthy();
  });
});

test("a guest sees the 'Publica tu espacio' entry", async () => {
  mockFetch({
    "/me": () => ({
      status: 200,
      body: {
        id: "user-1",
        email: "luis@uni.mx",
        displayName: "Luis Sosa",
        avatarUrl: null,
        role: "guest",
        bookingCount: 0,
        streakWeeks: 0,
        createdAt: new Date().toISOString(),
      },
    }),
  });

  const { getByText } = await renderProfile();
  await waitFor(() => expect(getByText("Publica tu espacio")).toBeTruthy());
});

test("'Cerrar sesión' confirms in a sheet then clears the session", async () => {
  mockFetch({
    "/me": () => ({
      status: 200,
      body: {
        id: "user-1",
        email: "luis@uni.mx",
        displayName: "Luis Sosa",
        avatarUrl: null,
        role: "guest",
        bookingCount: 0,
        streakWeeks: 0,
        createdAt: new Date().toISOString(),
      },
    }),
    "/auth/logout": () => ({ status: 204, body: null }),
  });

  const { getByText, getAllByText } = await renderProfile();
  await waitFor(() => expect(getByText("Cerrar sesión")).toBeTruthy());

  fireEvent.press(getByText("Cerrar sesión"));
  await waitFor(() => expect(getByText("¿Cerrar sesión?")).toBeTruthy());

  // Two "Cerrar sesión" now (the row + the sheet's confirm button) — press the last.
  const confirms = getAllByText("Cerrar sesión");
  fireEvent.press(confirms[confirms.length - 1]!);

  await waitFor(() => expect(useAuthStore.getState().session).toBeNull());
});
