import { Linking, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { useColorScheme } from "nativewind";

import { haptics } from "@/lib/haptics";
import { MapPin } from "@/lib/icons";
import {
  type Coords,
  directionsUrl,
  hasMapsStaticKey,
  staticMapUrl,
} from "@/lib/maps";
import { useColor } from "@/lib/theme/useColor";

interface StaticMapCardProps {
  coords: Coords | null;
  address?: string | null;
  /** Card height in px. */
  height?: number;
}

/**
 * A tap-to-get-directions map rectangle at the bottom of the space detail.
 * Renders the Google static map when coordinates + a key are present; otherwise
 * the same grey `bg-fill` placeholder as before (no broken image ever — the
 * `<Image>` sits over the grey block, so a failed load degrades to grey). Tap
 * opens directions from the device's current location.
 */
export function StaticMapCard({ coords, address, height = 168 }: StaticMapCardProps) {
  const { colorScheme } = useColorScheme();
  const iconColor = useColor("label-3");

  const target: Coords | { address: string } | null = coords
    ? coords
    : address
      ? { address }
      : null;
  if (!target) return null;

  const mapUrl =
    coords && hasMapsStaticKey()
      ? staticMapUrl(coords, {
          width: 700,
          height,
          dark: colorScheme === "dark",
        })
      : null;

  function open() {
    if (!target) return;
    haptics.selection();
    void Linking.openURL(directionsUrl(target));
  }

  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel="Cómo llegar"
      style={{ height }}
      className="overflow-hidden rounded-group bg-fill"
    >
      {mapUrl ? (
        <Image
          source={{ uri: mapUrl }}
          style={{ width: "100%", height }}
          contentFit="cover"
          contentPosition="center"
          transition={150}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View className="flex-1 items-center justify-center gap-1">
          <MapPin size={20} color={iconColor} />
          <Text className="text-footnote text-label-3">Cómo llegar</Text>
        </View>
      )}
    </Pressable>
  );
}
