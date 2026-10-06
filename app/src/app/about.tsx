import { Pressable, ScrollView, Text, View } from "react-native";
import Constants from "expo-constants";
import { useRouter } from "expo-router";

import { BrandMark } from "@/components/BrandMark";
import { Group } from "@/components/Group";
import { Row } from "@/components/Row";
import { Screen } from "@/components/Screen";
import { ArrowLeft, BookOpen, Compass, ShieldCheck } from "@/lib/icons";
import { useColor } from "@/lib/theme/useColor";

// Tú → Acerca de Tempo (2026-10-06): the always-reachable home of the
// "datos ficticios / sin fines de lucro" note (also on the tutorial's first
// slide and the sign-in screen), plus links and the app version. Works with
// or without a session.
export default function AboutScreen() {
  const router = useRouter();
  const backColor = useColor("label-1");
  const version = Constants.expoConfig?.version ?? "";

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
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 8, gap: 20 }}>
        <View className="flex-row items-center" style={{ gap: 14 }}>
          <View style={{ borderRadius: 14, overflow: "hidden" }}>
            <BrandMark size={56} />
          </View>
          <View style={{ gap: 2 }}>
            <Text
              className="text-label-1"
              style={{ fontFamily: "SpaceGrotesk_700Bold", fontSize: 26 }}
            >
              Tempo
            </Text>
            <Text className="text-subhead text-label-3">
              Reservas de espacios por horas
            </Text>
          </View>
        </View>

        <View className="gap-2">
          <Text className="text-body-emph text-label-1">Versión de prueba</Text>
          <Text className="text-body text-label-2">
            Por ahora, los espacios, horarios, fotos y ubicaciones que ves son
            ficticios: son datos de demostración inspirados en campus de la UNAM y
            el IPN, que no están afiliados a Tempo. Apartar un lugar no reserva
            nada real y nadie te va a esperar en el espacio.
          </Text>
        </View>

        <View className="gap-2">
          <Text className="text-body-emph text-label-1">Sin fines de lucro</Text>
          <Text className="text-body text-label-2">
            Tempo es un proyecto personal sin fines de lucro. No cobra nada, no
            tiene anuncios y no vende ni comparte tus datos. Tu cuenta solo sirve
            para guardar tus reservas, favoritos y avisos.
          </Text>
        </View>

        <Group dividerInset={48}>
          <Row
            icon={Compass}
            title="Ver el tutorial de nuevo"
            trailing="chevron"
            onPress={() => router.push("/welcome")}
          />
          <Row
            icon={ShieldCheck}
            title="Política de privacidad"
            trailing="chevron"
            onPress={() => router.push("/privacy")}
          />
          <Row
            icon={BookOpen}
            title="Términos de uso"
            trailing="chevron"
            onPress={() => router.push("/terms")}
          />
        </Group>

        {version ? (
          <Text className="pl-1 text-footnote text-label-4">Tempo v{version}</Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
