import { useState, type ComponentType } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { Button } from "@/components/Button";
import { HostUpgradedSheet } from "@/components/HostUpgradedSheet";
import { Screen } from "@/components/Screen";
import { ArrowLeft, Clock, MapPin, QrCode, type IconProps } from "@/lib/icons";
import { useAuthStore } from "@/lib/session";
import { useColor } from "@/lib/theme/useColor";

const POINTS: { icon: ComponentType<IconProps>; title: string; body: string }[] = [
  {
    icon: MapPin,
    title: "Publica lugares y espacios",
    body: "Nombre, ubicación, capacidad. Dos minutos.",
  },
  {
    icon: Clock,
    title: "Define tus horarios disponibles",
    body: "Días, horas y duración del bloque. Tempo genera el resto.",
  },
  {
    icon: QrCode,
    title: "Escanea el QR de cada reserva",
    body: "Confirmas la visita en el momento en que llega.",
  },
];

// Handoff B — full-screen, pushed from the profile's "Publica tu espacio" row.
export default function BecomeHostScreen() {
  const router = useRouter();
  const becomeHost = useAuthStore((s) => s.becomeHost);
  const backColor = useColor("label-1");
  const tintColor = useColor("tint");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgraded, setUpgraded] = useState(false);

  async function handleUpgrade() {
    setBusy(true);
    setError(null);
    try {
      await becomeHost();
      setUpgraded(true);
    } catch {
      setError("No pudimos activar tu cuenta de anfitrión. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen bg="card" edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 16 }}>
        <View className="px-6 pt-2">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Volver"
            className="h-9 w-9 items-center justify-center rounded-full bg-fill"
          >
            <ArrowLeft size={18} color={backColor} />
          </Pressable>
        </View>

        <View className="flex-1 gap-10 px-6 pt-8">
          {/* The three-block "T" mark — pure geometry, no image. */}
          <View style={{ width: 73, height: 34 }}>
            <View
              className="absolute rounded-[3px] bg-tint"
              style={{ left: 31, top: 0, width: 11, height: 34 }}
            />
            <View
              className="absolute rounded-[3px] bg-tint-soft"
              style={{ left: 0, top: 0, width: 44, height: 11 }}
            />
            <View
              className="absolute rounded-[3px] bg-tint"
              style={{ left: 47, top: 0, width: 26, height: 11 }}
            />
          </View>

          <View className="gap-3">
            <Text className="text-title-lg text-label-1">
              Publica tu espacio en Tempo
            </Text>
            <Text className="text-body text-label-3">
              Sin solicitudes ni aprobaciones. Publicas, defines horarios y
              recibes visitas.
            </Text>
          </View>

          <View className="gap-6">
            {POINTS.map(({ icon: Icon, title, body }) => (
              <View key={title} className="flex-row gap-4">
                <View className="h-10 w-10 items-center justify-center rounded-[12px] bg-tint-wash">
                  <Icon size={20} color={tintColor} />
                </View>
                <View className="flex-1 gap-1">
                  <Text className="text-body-emph text-label-1">{title}</Text>
                  <Text className="text-subhead leading-[21px] text-label-3">
                    {body}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View className="gap-2 px-6 pt-6">
          {error ? (
            <Text className="text-center text-footnote text-state-error">
              {error}
            </Text>
          ) : null}
          <Button variant="filled" loading={busy} onPress={handleUpgrade}>
            Convertirme en anfitrión
          </Button>
          <Text className="text-center text-footnote text-label-4">
            Seguirás pudiendo reservar como invitado.
          </Text>
        </View>
      </ScrollView>

      <HostUpgradedSheet
        isOpen={upgraded}
        onClose={() => {
          setUpgraded(false);
          router.back();
        }}
        onGoToSpaces={() => {
          setUpgraded(false);
          // TODO(PR B1): → "/(owner)". Until the host route group exists, land
          // on the (guest-side) profile, which now shows the host entry row.
          router.replace("/(tabs)/profile");
        }}
      />
    </Screen>
  );
}
