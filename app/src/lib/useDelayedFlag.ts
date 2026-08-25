import { useEffect, useState } from "react";

/**
 * Returns true only once `flag` has been continuously true for `delayMs`.
 * Used to gate Skeleton rows so they never mount for fast responses — per
 * the handoff: "Aparece solo si la respuesta tarda >150 ms."
 */
export function useDelayedFlag(flag: boolean, delayMs: number): boolean {
  const [delayed, setDelayed] = useState(false);

  useEffect(() => {
    if (!flag) {
      return;
    }
    const timeout = setTimeout(() => setDelayed(true), delayMs);
    return () => clearTimeout(timeout);
  }, [flag, delayMs]);

  // Masking with `flag` (rather than resetting `delayed` in the effect)
  // avoids a synchronous setState in the effect body.
  return flag && delayed;
}
