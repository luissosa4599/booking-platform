import { useEffect, useRef, useState } from "react";
import {
  type GestureResponderEvent,
  Pressable,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useColorScheme } from "nativewind";

import { Group } from "@/components/Group";
import { reverseGeocode } from "@/lib/api/geocode";
import { haptics } from "@/lib/haptics";
import { MapPin, Minus, Plus } from "@/lib/icons";
import { requestAndGetPosition } from "@/lib/location";
import { type Coords, hasMapsStaticKey, pxToLatLng, staticMapUrl } from "@/lib/maps";
import { useColor } from "@/lib/theme/useColor";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

const BOX_HEIGHT = 200;
const DEFAULT_CENTER: Coords = { lat: 19.4326, lng: -99.1332 }; // CDMX
const MIN_ZOOM = 3;
const MAX_ZOOM = 19;

export interface LocationValue {
  lat: number;
  lng: number;
  address: string | null;
}

interface LocationPickerProps {
  value: LocationValue | null;
  onChange: (next: LocationValue) => void;
  /** Shown above the address field. */
  label?: string;
}

export function LocationPicker({ value, onChange, label }: LocationPickerProps) {
  const { width: windowWidth } = useWindowDimensions();
  const { colorScheme } = useColorScheme();
  const boxWidth = Math.max(0, windowWidth - 32);

  const [center, setCenter] = useState<Coords>(
    value ? { lat: value.lat, lng: value.lng } : DEFAULT_CENTER,
  );
  const [zoom, setZoom] = useState(15);
  const [address, setAddress] = useState(value?.address ?? "");
  const [locating, setLocating] = useState(false);
  // The user typed in the address box — stop auto-geocoding from overwriting it
  // until they move the pin again.
  const addressIsManual = useRef(!!value?.address);

  const hasKey = hasMapsStaticKey();
  const pinColor = useColor("tint");
  const iconColor = useColor("label-1");
  const placeholderColor = useColor("label-4");

  const mapUrl = hasKey
    ? staticMapUrl(center, {
        width: boxWidth,
        height: BOX_HEIGHT,
        dark: colorScheme === "dark",
      })
    : null;

  // Debounced reverse-geocode after the pin settles.
  const settledCenter = useDebouncedValue(center, 500);
  useEffect(() => {
    if (addressIsManual.current) return;
    let cancelled = false;
    void reverseGeocode(settledCenter.lat, settledCenter.lng).then((found) => {
      if (cancelled || addressIsManual.current || !found) return;
      setAddress(found);
      onChange({ lat: settledCenter.lat, lng: settledCenter.lng, address: found });
    });
    return () => {
      cancelled = true;
    };
    // onChange identity isn't stable in callers; keying on the settled center is
    // what actually matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settledCenter.lat, settledCenter.lng]);

  function moveTo(next: Coords) {
    addressIsManual.current = false;
    setCenter(next);
    onChange({ lat: next.lat, lng: next.lng, address: address || null });
  }

  function handleMapPress(e: GestureResponderEvent) {
    if (!hasKey || boxWidth <= 0) return;
    const { locationX, locationY } = e.nativeEvent;
    haptics.selection();
    moveTo(pxToLatLng(locationX, locationY, center, zoom, boxWidth, BOX_HEIGHT));
  }

  function handleZoom(delta: number) {
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + delta)));
  }

  async function handleUseMyLocation() {
    setLocating(true);
    const pos = await requestAndGetPosition();
    setLocating(false);
    if (pos) {
      setZoom(16);
      moveTo(pos);
    }
  }

  function handleAddressChange(text: string) {
    addressIsManual.current = true;
    setAddress(text);
    onChange({ lat: center.lat, lng: center.lng, address: text || null });
  }

  return (
    <View className="gap-2">
      {label ? (
        <Text className="pl-1 text-footnote font-semibold uppercase text-label-4">
          {label}
        </Text>
      ) : null}

      <View
        style={{ width: boxWidth, height: BOX_HEIGHT }}
        className="overflow-hidden rounded-group bg-fill"
      >
        <Pressable onPress={handleMapPress} className="flex-1">
          {mapUrl ? (
            <Image
              source={{ uri: mapUrl }}
              style={{ width: boxWidth, height: BOX_HEIGHT }}
              contentFit="cover"
              transition={120}
            />
          ) : (
            <View className="flex-1 items-center justify-center gap-1">
              <MapPin size={22} color={iconColor} />
              <Text className="text-footnote text-label-3">
                Sin mapa — escribe la dirección
              </Text>
            </View>
          )}
        </Pressable>

        {/* Centre pin — tip at the exact centre of the box. */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: boxWidth / 2 - 12,
            top: BOX_HEIGHT / 2 - 24,
          }}
        >
          <MapPin size={24} color={pinColor} fill={pinColor} />
        </View>

        {hasKey ? (
          <View
            style={{ position: "absolute", right: 10, bottom: 10 }}
            className="overflow-hidden rounded-control bg-card"
          >
            <Pressable
              onPress={() => handleZoom(1)}
              accessibilityLabel="Acercar"
              className="h-8 w-8 items-center justify-center border-b border-hairline"
            >
              <Plus size={16} color={iconColor} />
            </Pressable>
            <Pressable
              onPress={() => handleZoom(-1)}
              accessibilityLabel="Alejar"
              className="h-8 w-8 items-center justify-center"
            >
              <Minus size={16} color={iconColor} />
            </Pressable>
          </View>
        ) : null}
      </View>

      <Pressable
        onPress={handleUseMyLocation}
        accessibilityRole="button"
        className="h-9 flex-row items-center justify-center gap-1.5 rounded-control bg-fill"
      >
        <MapPin size={14} color={pinColor} />
        <Text className="text-subhead text-tint-press">
          {locating ? "Ubicando…" : "Usar mi ubicación"}
        </Text>
      </Pressable>

      <Group>
        <TextInput
          value={address}
          onChangeText={handleAddressChange}
          placeholder="Dirección"
          placeholderTextColor={placeholderColor}
          className="px-4 py-[15px] text-body text-label-1"
        />
      </Group>

      {!hasKey ? (
        <Text className="pl-1 text-footnote text-label-4">
          {center.lat.toFixed(5)}, {center.lng.toFixed(5)}
        </Text>
      ) : null}
    </View>
  );
}
