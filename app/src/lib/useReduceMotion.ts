import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

// Handoff accessibility note: scale/crossfade flourishes must respect the
// system "reduce motion" setting. Layout reflow (rows sliding to close a
// gap, screen pushes) is left alone — that's content actually moving, not
// decoration — but halos, pulses, and press/selection fades all gate on this.
export function useReduceMotion() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) {
        setReduceMotion(enabled);
      }
    });
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}
