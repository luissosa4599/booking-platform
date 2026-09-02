import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import Index from "../(tabs)/index";

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

jest.mock("expo-crypto", () => ({
  randomUUID: () => "test-uuid",
}));

// @gorhom/bottom-sheet relies on real native layout/portal machinery that
// doesn't run under the test renderer — see __mocks__/@gorhom/bottom-sheet.tsx.
jest.mock("@gorhom/bottom-sheet");

// lucide-react-native ships ESM-only .mjs files Jest can't parse by default
// — see __mocks__/lucide-react-native.tsx.
jest.mock("lucide-react-native");

const RESOURCE_TYPES = [
  {
    id: "type-1",
    name: "Sala de estudio",
    labels: {
      singular: "sala",
      plural: "salas",
      capacityUnit: "personas",
      actionVerb: "Apartar",
    },
    allowsMultipleSeats: true,
    allowsWaitlist: true,
  },
];

function nowSlot(overrides: Partial<Record<string, unknown>> = {}) {
  const now = new Date();
  return {
    id: "slot-1",
    resourceId: "resource-1",
    resourceName: "Sala Boreal 204",
    resourceTypeId: "type-1",
    locationName: "Biblioteca Central",
    startsAt: new Date(now.getTime() - 10 * 60_000).toISOString(),
    endsAt: new Date(now.getTime() + 60 * 60_000).toISOString(),
    capacityRemaining: 3,
    rowVersion: 1,
    ...overrides,
  };
}

type FetchHandler = () => { status: number; body: unknown };

// GET /availability returns an envelope: { slots, emptyContext }.
function availability(slots: unknown[], emptyContext: unknown = null) {
  return { status: 200, body: { slots, emptyContext } };
}

// A real fetch mock keyed by path, not a fixed response — every test still
// exercises the same lib/api/client.ts + TanStack Query code paths the app
// uses against the real backend, just with the network call swapped out
// (no real backend reachable from the Jest environment).
function mockFetch(handlers: Record<string, FetchHandler>) {
  globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const match = Object.entries(handlers).find(([path]) => url.includes(path));
    if (!match) {
      throw new Error(`Unhandled fetch in test: ${url}`);
    }
    const { status, body } = match[1]();
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as Response;
  }) as unknown as typeof fetch;
}

let queryClient: QueryClient;

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
});

afterEach(() => {
  queryClient.clear();
});

function renderScreen() {
  return render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <QueryClientProvider client={queryClient}>
        <Index />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

test("renders ExploreScreen without crashing", async () => {
  mockFetch({
    "/resource-types": () => ({ status: 200, body: [] }),
    "/availability": () => availability([]),
  });

  const { getByText } = await renderScreen();

  await waitFor(() => {
    expect(getByText("Ahora")).toBeTruthy();
  });
});

test("renders a real available slot grouped under LIBRE AHORA MISMO", async () => {
  mockFetch({
    "/resource-types": () => ({ status: 200, body: RESOURCE_TYPES }),
    "/availability": () => availability([nowSlot()]),
  });

  const { getByText } = await renderScreen();

  await waitFor(() => {
    expect(getByText("LIBRE AHORA MISMO")).toBeTruthy();
    expect(getByText("Sala Boreal 204")).toBeTruthy();
  });
});

test("shows ConflictSheet when POST /bookings returns 409", async () => {
  mockFetch({
    "/resource-types": () => ({ status: 200, body: RESOURCE_TYPES }),
    "/availability": () => availability([nowSlot()]),
    "/bookings": () => ({
      status: 409,
      body: {
        message: "Someone else just booked this slot.",
        availabilitySlotId: "slot-1",
        alternatives: [],
      },
    }),
  });

  const { getByText } = await renderScreen();

  await waitFor(() => {
    expect(getByText("Apartar")).toBeTruthy();
  });

  fireEvent.press(getByText("Apartar"));

  await waitFor(() => {
    expect(getByText("Alguien se adelantó")).toBeTruthy();
  });
});
