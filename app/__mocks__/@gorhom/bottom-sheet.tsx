// Manual mock for tests. @gorhom/bottom-sheet relies on real native
// layout/portal machinery that doesn't run under the test renderer, so this
// renders children directly instead. Lives in __mocks__/ (not inline via
// jest.mock(factory) in a test file) because NativeWind's babel transform
// injects a module-scoped CSS-interop helper into any file using View/Text —
// including test files that import screens — which Jest's mock-factory
// out-of-scope-variable check then rejects. A separate module has its own
// scope and sidesteps that entirely.
import { forwardRef, Fragment, useImperativeHandle, type ReactNode } from "react";

interface MockBottomSheetHandle {
  expand: () => void;
  close: () => void;
}

const BottomSheet = forwardRef<MockBottomSheetHandle, { children?: ReactNode }>(
  ({ children }, ref) => {
    useImperativeHandle(ref, () => ({ expand: () => {}, close: () => {} }));
    return <Fragment>{children}</Fragment>;
  },
);

export function BottomSheetView({ children }: { children?: ReactNode }) {
  return <Fragment>{children}</Fragment>;
}

export function BottomSheetBackdrop() {
  return null;
}

export default BottomSheet;
