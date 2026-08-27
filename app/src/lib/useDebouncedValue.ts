import { useEffect, useState } from "react";

/**
 * Returns `value` delayed by `delayMs` — the debounced copy only catches up
 * once the input has been still for that long. Used for the Explore search
 * field so every keystroke doesn't fire a `/availability` request.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
}
