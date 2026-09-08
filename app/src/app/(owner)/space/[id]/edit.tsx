import { useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Button } from "@/components/Button";
import { Group } from "@/components/Group";
import { Screen } from "@/components/Screen";
import { Stepper } from "@/components/Stepper";
import { useOwnerSpace, useUpdateSpace } from "@/lib/api/owner";
import { useUserId } from "@/lib/session";
import { useColor } from "@/lib/theme/useColor";

export default function EditSpaceScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId();
  const placeholderColor = useColor("label-4");
  const { data: space } = useOwnerSpace(id ?? "", userId);
  const updateSpace = useUpdateSpace(id ?? "");

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [capacity, setCapacity] = useState(1);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Guarded one-shot hydrate during render — a useEffect here trips
  // react-hooks/set-state-in-effect (same pattern as ResourceScreen's repeat).
  const [hydrated, setHydrated] = useState(false);
  if (space && !hydrated) {
    setName(space.name);
    setAddress(space.locationAddress ?? "");
    setCapacity(space.capacity);
    setDescription(space.description ?? "");
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
        address: address.trim() || null,
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

          <Field label="DIRECCIÓN">
            <Group>
              <TextInput
                value={address}
                onChangeText={setAddress}
                placeholder="Dirección (opcional)"
                placeholderTextColor={placeholderColor}
                className="px-4 py-[15px] text-body text-label-1"
              />
            </Group>
          </Field>

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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="gap-2">
      <Text className="pl-1 text-footnote font-semibold uppercase text-label-4">{label}</Text>
      {children}
    </View>
  );
}
