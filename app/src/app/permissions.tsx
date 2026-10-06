import { useCallback, useEffect, useState, type ComponentType } from "react";
import { AppState, Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { Camera as ExpoCamera } from "expo-camera";
import { useFocusEffect, useRouter } from "expo-router";

import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { getCalendarPermissionAsync } from "@/lib/calendar";
import {
  ArrowLeft,
  Bell,
  Calendar,
  Camera,
  ImagePlus,
  MapPin,
  type IconProps,
} from "@/lib/icons";
import { getPermissionState } from "@/lib/location";
import { useLocationStore } from "@/lib/locationStore";
import {
  getNotificationPermissionAsync,
  requestNotificationPermissionAsync,
} from "@/lib/notifications";
import { useColor } from "@/lib/theme/useColor";

// Tú → Permisos (2026-10-06): what each permission is for and when it's asked,
// with its live status. Location + notifications can be granted right here
// (the explanation is on screen); anything already denied points to the OS
// settings. Web only has location (the browser owns that permission).

type Status = "granted" | "denied" | "undetermined" | "n/a";

interface Statuses {
  location: Status;
  notifications: Status;
  calendar: Status;
  camera: Status;
}

const INITIAL: Statuses = {
  location: "n/a",
  notifications: "n/a",
  calendar: "n/a",
  camera: "n/a",
};

function fromPermission(p: { granted: boolean; canAskAgain: boolean } | null): Status {
  if (!p) return "n/a";
  if (p.granted) return "granted";
  return p.canAskAgain ? "undetermined" : "denied";
}

async function readStatuses(): Promise<Statuses> {
  const isNative = Platform.OS !== "web";
  const [location, notifications, calendar, camera] = await Promise.all([
    getPermissionState(),
    getNotificationPermissionAsync(),
    getCalendarPermissionAsync(),
    isNative
      ? ExpoCamera.getCameraPermissionsAsync().catch(() => null)
      : Promise.resolve(null),
  ]);
  return {
    location,
    notifications: fromPermission(notifications),
    calendar: fromPermission(calendar),
    camera: fromPermission(camera),
  };
}

export default function PermissionsScreen() {
  const router = useRouter();
  const backColor = useColor("label-1");
  const requestLocation = useLocationStore((s) => s.requestFromUser);
  const [statuses, setStatuses] = useState<Statuses>(INITIAL);

  const refresh = useCallback(() => {
    void readStatuses().then(setStatuses);
  }, []);

  useFocusEffect(refresh);
  // Coming back from the OS settings doesn't re-focus the screen — re-read on
  // app foreground too.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const isNative = Platform.OS !== "web";

  return (
    <Screen bg="canvas">
      <View className="flex-row items-center px-4 py-2">
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          className="h-9 w-9 items-center justify-center rounded-full bg-fill"
        >
          <ArrowLeft size={18} color={backColor} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 8, gap: 16 }}>
        <Text className="text-title-lg text-label-1">Permisos</Text>
        <Text className="text-body text-label-3">
          Todos son opcionales. Te explicamos para qué sirve cada uno antes de
          pedirlo, y Tempo funciona sin ellos.
        </Text>

        <PermissionCard
          icon={MapPin}
          title="Ubicación"
          body="Para ordenar los espacios por cercanía, mostrar la distancia y centrar el mapa. Solo mientras usas la app; no guardamos un historial."
          when="Se pide en el tutorial o al elegir el orden «Más cerca»."
          status={statuses.location}
          onAsk={async () => {
            await requestLocation();
            refresh();
          }}
        />

        {isNative ? (
          <>
            <PermissionCard
              icon={Bell}
              title="Notificaciones"
              body="Para recordarte tu reserva 30 minutos antes y avisarte si se libera un lugar en tu lista de espera. Nada de publicidad."
              when="Se pide en el tutorial o después de tu primera reserva."
              status={statuses.notifications}
              onAsk={async () => {
                await requestNotificationPermissionAsync();
                refresh();
              }}
            />
            <PermissionCard
              icon={Calendar}
              title="Calendario"
              body="Para agregar una reserva a tu calendario. Solo escribimos ese evento; no leemos tus otros eventos."
              when="Se pide al tocar «Añadir al calendario». Si no lo das, copiamos los detalles."
              status={statuses.calendar}
            />
            <PermissionCard
              icon={Camera}
              title="Cámara"
              tag="Solo anfitriones"
              body="Para leer el código QR de las reservas al registrar llegadas. No se toman ni se guardan fotos."
              when="Se pide al abrir «Escanear»."
              status={statuses.camera}
            />
            <PermissionCard
              icon={ImagePlus}
              title="Fotos"
              tag="Solo anfitriones"
              body="Para que elijas fotos de tu espacio al publicarlo. Solo se suben las que elijas."
              when="Se usa el selector de fotos del sistema al agregar fotos."
              status="n/a"
            />
            <Button variant="gray" onPress={() => void Linking.openSettings()}>
              Abrir ajustes de la app
            </Button>
          </>
        ) : (
          <Text className="text-footnote text-label-4">
            En la web, el navegador administra este permiso (el ícono junto a la
            dirección). Notificaciones, calendario, cámara y fotos solo los usa
            la app de Android.
          </Text>
        )}
      </ScrollView>
    </Screen>
  );
}

function PermissionCard({
  icon: Icon,
  title,
  tag,
  body,
  when,
  status,
  onAsk,
}: {
  icon: ComponentType<IconProps>;
  title: string;
  tag?: string;
  body: string;
  when: string;
  status: Status;
  onAsk?: () => void | Promise<void>;
}) {
  const bg = useColor("card");
  const border = useColor("hairline");
  const iconColor = useColor("tint-press");
  const okColor = useColor("state-free");
  const mutedColor = useColor("label-3");
  const [asking, setAsking] = useState(false);

  const statusText =
    status === "granted"
      ? "Permitido"
      : status === "denied"
        ? Platform.OS === "web"
          ? "No permitido · cámbialo en tu navegador"
          : "No permitido · cámbialo en Ajustes"
        : status === "undetermined"
          ? "Aún no se ha pedido"
          : null;

  return (
    <View
      style={{
        backgroundColor: bg,
        borderColor: border,
        borderWidth: 1,
        borderRadius: 16,
        padding: 16,
        gap: 10,
      }}
    >
      <View className="flex-row items-start" style={{ gap: 12 }}>
        <Icon size={22} color={iconColor} />
        <View className="flex-1" style={{ gap: 4 }}>
          <View className="flex-row flex-wrap items-center" style={{ gap: 8 }}>
            <Text className="text-body-emph text-label-1">{title}</Text>
            {tag ? <Text className="text-footnote text-label-4">{tag}</Text> : null}
          </View>
          <Text className="text-subhead text-label-2">{body}</Text>
          <Text className="text-footnote text-label-3">{when}</Text>
        </View>
      </View>
      {statusText ? (
        <Text
          className="text-subhead font-semibold"
          style={{ color: status === "granted" ? okColor : mutedColor }}
        >
          {statusText}
        </Text>
      ) : null}
      {status === "undetermined" && onAsk ? (
        <Button
          variant="pill"
          tone="wash"
          loading={asking}
          onPress={async () => {
            setAsking(true);
            await onAsk();
            setAsking(false);
          }}
        >
          {`Permitir ${title.toLowerCase()}`}
        </Button>
      ) : null}
    </View>
  );
}
