import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { Group } from "@/components/Group";
import { LocationPicker, type LocationValue } from "@/components/LocationPicker";
import { PhotoCarousel } from "@/components/PhotoCarousel";
import { PhotoManager } from "@/components/PhotoManager";
import { Screen } from "@/components/Screen";
import { Stepper } from "@/components/Stepper";
import { useOwnerSpace, useUpdateSpace } from "@/lib/api/owner";
import { stockImageUrl } from "@/lib/stockImages";
import { useUserId } from "@/lib/session";
import { useColor } from "@/lib/theme/useColor";

const HERO_HEIGHT = 168;

export default function EditSpaceScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId();
  const placeholderColor = useColor("label-4");
  const { data: space } = useOwnerSpace(id ?? "", userId);
  const updateSpace = useUpdateSpace(id ?? "");

  const [name, setName] = useState("");
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [capacity, setCapacity] = useState(1);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Guarded one-shot hydrate during render — a useEffect here trips
  // react-hooks/set-state-in-effect (same pattern as ResourceScreen's repeat).
  const [hydrated, setHydrated] = useState(false);
  if (space && !hydrated) {
    setName(space.name);
    setCapacity(space.capacity);
    setDescription(space.description ?? "");
    setLocation({
      lat: space.locationLatitude,
      lng: space.locationLongitude,
      address: space.locationAddress ?? null,
    });
    setHydrated(true);
  }

  const canSubmit = name.trim().length >= 3;

  async function submit() {
    if (!canSubmit) return;
    setError(null);
    try {
      await updateSpace.mutateAsync({
        name: name.trim(),
        description: description.trim() || null,
        capacity,
        address: location?.address ?? null,
        locationLatitude: location?.lat ?? null,
        locationLongitude: location?.lng ?? null,
      });
      router.back();
    } catch {
      setError("No pudimos guardar los cambios.");
    }
  }

  return (
    <Screen bg="canvas" edges={["top", "bottom"]}>
      <View className="flex-row items-center justify-between px-4 py-2">
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Cancelar">
          <Text className="text-body text-tint">Cancelar</Text>
        </Pressable>
        <Text className="text-body-emph text-label-1" numberOfLines={1}>
          {space?.name ?? "Editar"}
        </Text>
        <View className="w-16" />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 16 }}>
          <View
            style={{ height: HERO_HEIGHT }}
            className="overflow-hidden rounded-group"
          >
            <PhotoCarousel
              photos={space?.images.map((i) => i.url) ?? []}
              contentHeight={HERO_HEIGHT}
              fallbackUrl={stockImageUrl(space?.resourceTypeName, {
                width: 800,
                height: HERO_HEIGHT,
              })}
            />
          </View>

          {space ? (
            <PhotoManager spaceId={space.id} images={space.images} />
          ) : null}

          <Field label="NOMBRE">
            <Group>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholderTextColor={placeholderColor}
                className="px-4 py-[15px] text-body text-label-1"
              />
            </Group>
          </Field>

          <LocationPicker
            label="UBICACIÓN"
            value={location}
            onChange={setLocation}
          />

          {space?.allowsMultipleSeats ? (
            <Field label="CAPACIDAD">
              <Group>
                <View className="flex-row items-center justify-between px-4 py-3">
                  <Text className="text-body text-label-1">Lugares por bloque</Text>
                  <Stepper value={capacity} min={1} max={60} onChange={setCapacity} />
                </View>
              </Group>
            </Field>
          ) : null}

          <Field label="DESCRIPCIÓN · OPCIONAL">
            <Group>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Qué hay dentro, reglas, cómo llegar…"
                placeholderTextColor={placeholderColor}
                multiline
                className="min-h-[62px] px-4 py-[15px] text-body text-label-1"
              />
            </Group>
          </Field>

          {error ? (
            <Text className="text-center text-footnote text-state-error">{error}</Text>
          ) : null}
        </ScrollView>

        <View className="border-t border-hairline-inset bg-glass px-4 pb-3 pt-3">
          <Button
            variant="filled"
            disabled={!canSubmit}
            loading={updateSpace.isPending}
            onPress={submit}
          >
            Guardar cambios
          </Button>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
