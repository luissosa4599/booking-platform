import { Linking, Pressable } from "react-native";

import { haptics } from "@/lib/haptics";
import { Navigation } from "@/lib/icons";
import { directionsUrl, type Coords } from "@/lib/maps";
import { useColor } from "@/lib/theme/useColor";

interface DirectionsButtonProps {
  coords: Coords;
}

/**
 * A round "Cómo llegar" icon button — opens Google Maps directions from the
 * device's current location to `coords`, same one-tap behavior as the
 * resource detail's `StaticMapCard`. Surfaced directly on the Explore card
 * (2026-09-19 report) so getting to a space doesn't require opening its
 * detail screen first.
 */
export function DirectionsButton({ coords }: DirectionsButtonProps) {
  const iconColor = useColor("label-2");

  function open() {
    haptics.selection();
    void Linking.openURL(directionsUrl(coords));
  }

  return (
    <Pressable
      onPress={open}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Cómo llegar"
      className="h-9 w-9 items-center justify-center rounded-full bg-fill"
    >
      <Navigation size={16} strokeWidth={2} color={iconColor} />
    </Pressable>
  );
}
