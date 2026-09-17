import { Image, Pressable, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { SELECTED_CARD_BOTTOM, type MapPlace } from "./SpaceMap.types";

/**
 * Shared between `SpaceMap.web.tsx` and `SpaceMap.native.tsx` — plain RN
 * views, nothing DOM-specific, so both platforms render the identical card.
 * Extracted 2026-09-17 when the native map stopped being a placeholder.
 *
 * Redesign handoff §"SelectedPinCard" — a horizontal card anchored to the
 * bottom of the map, directly above the Lista/Mapa toggle (matches the
 * reference image exactly — 2026-09-14 report), reusing the same visual
 * language as `ResourceCard`'s row variant (photo thumbnail + text +
 * compact CTA) at a smaller size.
 */
export function SelectedPlaceCard({ place, onAction }: { place: MapPlace; onAction: () => void }) {
  const statusLabel = place.state === "free" ? "Libre" : `Libre en ${place.soonMinutes} min`;

  return (
    <View
      className="border border-hairline bg-card"
      style={{
        position: "absolute",
        left: 16,
        right: 16,
        // Coupled to MAP_TOGGLE_BOTTOM (SpaceMap.types.ts), not an
        // independently-tuned number — sits right above the toggle with a
        // 12px gap always, so the two can't drift apart again.
        bottom: SELECTED_CARD_BOTTOM,
        borderRadius: 16,
        padding: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        shadowColor: "#0B0B0C",
        shadowOpacity: 0.14,
        shadowRadius: 30,
        shadowOffset: { width: 0, height: 12 },
        elevation: 6,
      }}
    >
      <Image
        source={{ uri: place.imageUri }}
        style={{ width: 56, height: 56, borderRadius: 10 }}
        resizeMode="cover"
      />
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} className="text-body-emph text-label-1">
          {place.name}
        </Text>
        <Text numberOfLines={1} className="text-footnote text-label-3">
          {place.locationName} · {place.capacityLabel}
        </Text>
        <Text numberOfLines={1} className="text-footnote">
          <Text
            className={place.state === "free" ? "text-state-free" : "text-state-last"}
            style={{ fontWeight: "600" }}
          >
            {statusLabel}
          </Text>
        </Text>
      </View>
      <Pressable onPress={(e) => e.stopPropagation()}>
        <Button variant="pill" tone="filled" onPress={onAction}>
          {place.actionLabel}
        </Button>
      </Pressable>
    </View>
  );
}

export function EmptyPlacesNotice() {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: "50%",
        left: 16,
        right: 16,
        alignItems: "center",
        transform: [{ translateY: -34 }],
      }}
    >
      <View
        className="items-center gap-1 rounded-2xl border border-hairline bg-card px-5 py-4"
        style={{ maxWidth: 280 }}
      >
        <Text className="text-center text-body-emph text-label-1">
          No hay ubicaciones disponibles
        </Text>
        <Text className="text-center text-footnote text-label-3">
          Ajusta los filtros o busca en otro horario.
        </Text>
      </View>
    </View>
  );
}
