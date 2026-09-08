import { useMemo, useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { Button } from "@/components/Button";
import { Group } from "@/components/Group";
import { Screen } from "@/components/Screen";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Stepper } from "@/components/Stepper";
import { useResourceTypes } from "@/lib/api/resourceTypes";
import { useCreateSpace } from "@/lib/api/owner";
import { useColor } from "@/lib/theme/useColor";

const DEFAULT_TZ = "America/Mexico_City";

export default function NewSpaceScreen() {
  const router = useRouter();
  const placeholderColor = useColor("label-4");
  const { data: types } = useResourceTypes();
  const createSpace = useCreateSpace();

  const [name, setName] = useState("");
  const [typeId, setTypeId] = useState<string | null>(null);
  const [locationName, setLocationName] = useState("");
  const [address, setAddress] = useState("");
  const [capacity, setCapacity] = useState(4);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const options = useMemo(
    () => (types ?? []).map((t) => ({ label: t.name, value: t.id })),
    [types],
  );
  const selectedType = (types ?? []).find((t) => t.id === (typeId ?? options[0]?.value));
  const effectiveTypeId = typeId ?? options[0]?.value ?? null;
  const allowsSeats = selectedType?.allowsMultipleSeats ?? true;

  const canSubmit =
    name.trim().length >= 3 && locationName.trim().length > 0 && !!effectiveTypeId;

  async function submit() {
    if (!canSubmit || !effectiveTypeId) return;
    setError(null);
    try {
      const space = await createSpace.mutateAsync({
        name: name.trim(),
        description: description.trim() || null,
        capacity: allowsSeats ? capacity : 1,
        resourceTypeId: effectiveTypeId,
        locationName: locationName.trim(),
        address: address.trim() || null,
        timeZone: DEFAULT_TZ,
      });
      router.replace(`/(owner)/space/${space.id}`);
    } catch {
      setError("No pudimos publicar el espacio. Revisa los datos e intenta de nuevo.");
    }
  }

  return (
    <Screen bg="canvas" edges={["top", "bottom"]}>
      <View className="flex-row items-center justify-between px-4 py-2">
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Cancelar">
          <Text className="text-body text-tint">Cancelar</Text>
        </Pressable>
        <Text className="text-body-emph text-label-1">Nuevo espacio</Text>
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
                placeholder="Sala Boreal 204"
                placeholderTextColor={placeholderColor}
                className="px-4 py-[15px] text-body text-label-1"
              />
            </Group>
          </Field>

          {options.length > 1 ? (
            <Field label="TIPO">
              <SegmentedControl
                options={options}
                value={effectiveTypeId ?? ""}
                onChange={setTypeId}
              />
            </Field>
          ) : null}

          <Field label="UBICACIÓN">
            <Group>
              <TextInput
                value={locationName}
                onChangeText={setLocationName}
                placeholder="Lugar (Biblioteca Central)"
                placeholderTextColor={placeholderColor}
                className="px-4 py-[15px] text-body text-label-1"
              />
              <TextInput
                value={address}
                onChangeText={setAddress}
                placeholder="Dirección (opcional)"
                placeholderTextColor={placeholderColor}
                className="px-4 py-[15px] text-body text-label-1"
              />
            </Group>
          </Field>

          {allowsSeats ? (
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
            loading={createSpace.isPending}
            onPress={submit}
          >
            Publicar
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
