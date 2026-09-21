import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { Screen } from "@/components/Screen";
import { ArrowLeft } from "@/lib/icons";
import { useColor } from "@/lib/theme/useColor";

// Required to publish the Google OAuth consent screen (Branding page needs a
// real Privacy Policy link before "Publicar app" unlocks) — 2026-09-14.
// Plain content, no session required (see `_layout.tsx`'s PUBLIC_SEGMENTS —
// Google links here for signed-out visitors reviewing the consent screen, and
// Play Console links here too). Reachable as a standalone deep link with no
// prior screen in the stack — `canGoBack()` guards the back button so it
// falls back to home instead of no-op'ing.
export default function PrivacyScreen() {
  const router = useRouter();
  const backColor = useColor("label-1");

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
      <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
        <Text className="text-title-lg text-label-1">Política de privacidad</Text>
        <Text className="text-footnote text-label-3">Última actualización: 14 de septiembre de 2026</Text>

        <View className="gap-2">
          <Text className="text-body-emph text-label-1">Qué es Tempo</Text>
          <Text className="text-body text-label-2">
            Tempo es un proyecto de demostración (portafolio) para reservar salones,
            auditorios, salas de lectura y cubículos de estudio dentro de un campus.
            No es un servicio comercial y no procesa pagos reales.
          </Text>
        </View>

        <View className="gap-2">
          <Text className="text-body-emph text-label-1">Qué información recopilamos</Text>
          <Text className="text-body text-label-2">
            • Tu correo electrónico y nombre, ya sea al crear una cuenta con correo y
            contraseña o al iniciar sesión con Google.{"\n"}
            • Las reservas que haces: espacio, horario y número de personas.{"\n"}
            • Tu ubicación aproximada, solo si activas el permiso, para ordenar los
            espacios por cercanía. Nunca se guarda un historial de ubicaciones.{"\n"}
            • Un identificador de notificaciones push (token de Expo), solo si
            aceptas recibir recordatorios de tus reservas.
          </Text>
        </View>

        <View className="gap-2">
          <Text className="text-body-emph text-label-1">Cómo usamos tu información</Text>
          <Text className="text-body text-label-2">
            Solo para operar la app: mostrarte tus reservas, calcular distancias,
            enviarte recordatorios y, si lo conectas, crear eventos en tu Google
            Calendar. No vendemos ni compartimos tu información con terceros con
            fines publicitarios.
          </Text>
        </View>

        <View className="gap-2">
          <Text className="text-body-emph text-label-1">Inicio de sesión con Google</Text>
          <Text className="text-body text-label-2">
            Al iniciar sesión con Google solo solicitamos tu nombre, correo y foto de
            perfil (los datos básicos de identidad), no acceso a tu cuenta de Google
            en general. Si además conectas Google Calendar desde tu perfil, ese
            permiso es independiente y puedes revocarlo en cualquier momento desde
            los ajustes de tu Cuenta de Google.
          </Text>
        </View>

        <View className="gap-2">
          <Text className="text-body-emph text-label-1">Eliminar tu información</Text>
          <Text className="text-body text-label-2">
            Escríbenos a luis.sosa.4599@gmail.com y eliminamos tu cuenta y tus datos.
          </Text>
        </View>

        <View className="gap-2">
          <Text className="text-body-emph text-label-1">Contacto</Text>
          <Text className="text-body text-label-2">luis.sosa.4599@gmail.com</Text>
        </View>
      </ScrollView>
    </Screen>
  );
}
