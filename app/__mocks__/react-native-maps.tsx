// Manual mock for tests. react-native-maps registers a real native/Fabric
// module (`RNMapsAirModule`) that doesn't exist under the test renderer —
// importing the real package throws `TurboModuleRegistry.getEnforcing(...)
// could not be found` outside a real native build. None of the current
// tests assert anything about map rendering, so a bare stand-in (renders
// `Marker` children, no-ops the imperative ref methods `SpaceMap.native.tsx`
// calls) is enough. Lives in __mocks__/ for the same "NativeWind's babel
// transform rejects an inline jest.mock factory" reason as
// __mocks__/@gorhom/bottom-sheet.tsx.
import { forwardRef, useImperativeHandle, type ReactNode } from "react";
import { View } from "react-native";

interface MockMapViewHandle {
  fitToCoordinates: () => void;
  animateToRegion: () => void;
}

const MapView = forwardRef<MockMapViewHandle, { children?: ReactNode }>(
  ({ children }, ref) => {
    useImperativeHandle(ref, () => ({
      fitToCoordinates: () => {},
      animateToRegion: () => {},
    }));
    return <View>{children}</View>;
  },
);

export function Marker({ children }: { children?: ReactNode }) {
  return <View>{children}</View>;
}

export const PROVIDER_GOOGLE = "google";

export default MapView;
