import { useRef, useState, type ComponentType, type ReactNode } from "react";
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { Bell, Compass, Info, MapPin, QrCode, type IconProps } from "@/lib/icons";
import { useLocationStore } from "@/lib/locationStore";
import { requestNotificationPermissionAsync } from "@/lib/notifications";
import { useOnboardingStore } from "@/lib/onboardingStore";
import { useAuthStore } from "@/lib/session";
import { useColor } from "@/lib/theme/useColor";

// First-run tutorial (2026-10-06): skippable, shown once (lib/onboardingStore),
// re-openable from Tú → Acerca de Tempo. Slide 1 carries the "datos ficticios /
// sin fines de lucro" note; the last slide explains location + notifications
// BEFORE the OS dialog appears (nothing is asked if the user skips).

type Step = { key: string; render: () => ReactNode };

export default function WelcomeScreen() {
  const router = useRouter();
  const markSeen = useOnboardingStore((s) => s.markSeen);
  const hasSession = useAuthStore((s) => !!s.session);
  const canGoBack = router.canGoBack();
  const skipColor = useColor("label-3");
  const dotOn = useColor("tint");
  const dotOff = useColor("hairline");

  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const steps: Step[] = [
    { key: "hello", render: () => <HelloSlide /> },
    {
      key: "explore",
      render: () => (
        <IconSlide
          icon={Compass}
          title="Explora y aparta en un toque"
          body="Ve qué salas, cubículos y auditorios están libres ahora y cerca de ti, en lista o en el mapa. Apartas con un solo toque y, si te ganan el lugar, te sugerimos otros horarios."
        />
      ),
    },
    {
      key: "pass",
      render: () => (
        <IconSlide
          icon={QrCode}
          title="Tu pase y tus avisos"
          body="Cada reserva trae un pase con código QR para registrar tu llegada. Te recordamos 30 minutos antes y te avisamos si se libera un lugar en tu lista de espera."
        />
      ),
    },
    { key: "permissions", render: () => <PermissionsSlide /> },
  ];
  const last = steps.length - 1;

  function onLayout(e: LayoutChangeEvent) {
    setWidth(e.nativeEvent.layout.width);
  }

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (width <= 0) return;
    setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  }

  function goTo(next: number) {
    const clamped = Math.max(0, Math.min(last, next));
    scrollRef.current?.scrollTo({ x: clamped * width, animated: true });
    setPage(clamped);
  }

  // Skip and finish both go on to sign-in on a first launch (where
  // "Continuar como invitado" lives), or back to wherever the tutorial was
  // re-opened from (Tú → Acerca de Tempo).
  function finish() {
    markSeen();
    if (router.canGoBack()) router.back();
    else router.replace(hasSession ? "/" : "/sign-in");
  }

  return (
    <Screen bg="canvas" edges={["top", "bottom"]}>
      <View className="h-11 flex-row items-center justify-end px-4">
        {page < last ? (
          <Pressable
            onPress={finish}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Omitir el tutorial"
          >
            <Text className="text-subhead font-semibold" style={{ color: skipColor }}>
              Omitir
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View className="flex-1" onLayout={onLayout}>
        {width > 0 ? (
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
            style={{ flex: 1 }}
          >
            {steps.map((step) => (
              <ScrollView
                key={step.key}
                style={{ width }}
                contentContainerStyle={{
                  flexGrow: 1,
                  justifyContent: "center",
                  paddingHorizontal: 28,
                  paddingVertical: 16,
                }}
                showsVerticalScrollIndicator={false}
              >
                {step.render()}
              </ScrollView>
            ))}
          </ScrollView>
        ) : null}
      </View>

      <View style={{ paddingHorizontal: 24, paddingBottom: 16, gap: 16 }}>
        <View className="flex-row justify-center" style={{ gap: 8 }}>
          {steps.map((step, i) => (
            <View
              key={step.key}
              style={{
                width: i === page ? 20 : 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: i === page ? dotOn : dotOff,
              }}
            />
          ))}
        </View>
        {page < last ? (
          <Button variant="filled" onPress={() => goTo(page + 1)}>
            Siguiente
          </Button>
        ) : (
          <Button variant="filled" onPress={finish}>
            {hasSession || canGoBack ? "Listo" : "Empezar"}
          </Button>
        )}
      </View>
    </Screen>
  );
}

function HelloSlide() {
  const noteBg = useColor("card");
  const noteBorder = useColor("hairline");
  const infoColor = useColor("tint-press");

  return (
    <View style={{ gap: 24 }}>
      <View style={{ gap: 16, alignItems: "center" }}>
        <View style={{ borderRadius: 22, overflow: "hidden" }}>
          <BrandMark size={84} />
        </View>
        <Text
          className="text-label-1"
          style={{ fontFamily: "SpaceGrotesk_700Bold", fontSize: 34 }}
        >
          Tempo
        </Text>
        <Text className="text-center text-body text-label-2">
          Aparta salas, cubículos y auditorios por horas.
        </Text>
      </View>

      <View
        style={{
          backgroundColor: noteBg,
          borderColor: noteBorder,
          borderWidth: 1,
          borderRadius: 16,
          padding: 16,
          gap: 10,
        }}
      >
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <Info size={18} color={infoColor} />
          <Text className="text-body-emph text-label-1">Antes de empezar</Text>
        </View>
        <Text className="text-subhead text-label-2">
          Esta es una versión de prueba: los espacios, horarios y fotos son
          ficticios. Apartar no reserva un lugar real.
        </Text>
        <Text className="text-subhead text-label-2">
          Tempo es un proyecto sin fines de lucro: no cobra nada ni vende tus
          datos.
        </Text>
      </View>
    </View>
  );
}

function IconSlide({
  icon: Icon,
  title,
  body,
}: {
  icon: ComponentType<IconProps>;
  title: string;
  body: string;
}) {
  const wash = useColor("tint-wash");
  const tint = useColor("tint-press");
  return (
    <View style={{ gap: 20, alignItems: "center" }}>
      <View
        className="items-center justify-center rounded-full"
        style={{ width: 96, height: 96, backgroundColor: wash }}
      >
        <Icon size={40} color={tint} strokeWidth={1.8} />
      </View>
      <Text className="text-center text-title-md text-label-1">{title}</Text>
      <Text className="text-center text-body text-label-3">{body}</Text>
    </View>
  );
}

type AskState = "idle" | "asking" | "granted" | "denied";

function PermissionsSlide() {
  const requestLocation = useLocationStore((s) => s.requestFromUser);
  const locationStatus = useLocationStore((s) => s.status);
  const [location, setLocation] = useState<AskState>(
    locationStatus === "granted" ? "granted" : "idle",
  );
  const [notifications, setNotifications] = useState<AskState>("idle");

  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 8 }}>
        <Text className="text-center text-title-md text-label-1">
          ¿Para qué pedimos permisos?
        </Text>
        <Text className="text-center text-body text-label-3">
          Son opcionales. Puedes cambiarlos cuando quieras en Tú → Permisos.
        </Text>
      </View>

      <PermissionRow
        icon={MapPin}
        title="Ubicación"
        body="Para ordenar los espacios por cercanía y centrar el mapa. Solo mientras usas la app; no guardamos tu historial."
        state={location}
        onAsk={async () => {
          setLocation("asking");
          setLocation((await requestLocation()) ? "granted" : "denied");
        }}
      />
      {Platform.OS !== "web" ? (
        <PermissionRow
          icon={Bell}
          title="Notificaciones"
          body="Para recordarte tu reserva 30 minutos antes y avisarte si se libera un lugar en tu lista de espera. Nada de publicidad."
          state={notifications}
          onAsk={async () => {
            setNotifications("asking");
            setNotifications((await requestNotificationPermissionAsync()) ? "granted" : "denied");
          }}
        />
      ) : null}
    </View>
  );
}

function PermissionRow({
  icon: Icon,
  title,
  body,
  state,
  onAsk,
}: {
  icon: ComponentType<IconProps>;
  title: string;
  body: string;
  state: AskState;
  onAsk: () => void;
}) {
  const bg = useColor("card");
  const border = useColor("hairline");
  const iconColor = useColor("tint-press");
  const okColor = useColor("state-free");
  const mutedColor = useColor("label-3");

  return (
    <View
      style={{
        backgroundColor: bg,
        borderColor: border,
        borderWidth: 1,
        borderRadius: 16,
        padding: 16,
        gap: 12,
      }}
    >
      <View className="flex-row items-start" style={{ gap: 12 }}>
        <Icon size={22} color={iconColor} />
        <View className="flex-1" style={{ gap: 4 }}>
          <Text className="text-body-emph text-label-1">{title}</Text>
          <Text className="text-subhead text-label-3">{body}</Text>
        </View>
      </View>
      {state === "granted" ? (
        <Text className="text-subhead font-semibold" style={{ color: okColor }}>
          Activado
        </Text>
      ) : state === "denied" ? (
        <Text className="text-subhead" style={{ color: mutedColor }}>
          No activado. Puedes activarlo después en Tú → Permisos.
        </Text>
      ) : (
        <Button variant="pill" tone="wash" loading={state === "asking"} onPress={onAsk}>
          {`Permitir ${title.toLowerCase()}`}
        </Button>
      )}
    </View>
  );
}
