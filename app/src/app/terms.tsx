import { ScrollView, Text, View } from "react-native";

import { Screen } from "@/components/Screen";

// Required to publish the Google OAuth consent screen (Branding page needs a
// real Terms of Service link before "Publicar app" unlocks) — 2026-09-14.
// Plain content, no session required — see `_layout.tsx`'s PUBLIC_SEGMENTS.
export default function TermsScreen() {
  return (
    <Screen bg="canvas">
      <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
        <Text className="text-title-lg text-label-1">Términos del servicio</Text>
        <Text className="text-footnote text-label-3">Última actualización: 14 de septiembre de 2026</Text>

        <View className="gap-2">
          <Text className="text-body-emph text-label-1">Qué es Tempo</Text>
          <Text className="text-body text-label-2">
            Tempo es un proyecto de demostración (portafolio), no un producto
            comercial. Se ofrece &quot;tal cual&quot;, sin garantías, y puede cambiar,
            interrumpirse o dejar de estar disponible en cualquier momento sin
            previo aviso.
          </Text>
        </View>

        <View className="gap-2">
          <Text className="text-body-emph text-label-1">Uso del servicio</Text>
          <Text className="text-body text-label-2">
            Las reservas dentro de la app son simuladas — no representan un
            compromiso real de disponibilidad de ningún espacio ni institución.
            No se procesan pagos reales en ningún flujo de la app.
          </Text>
        </View>

        <View className="gap-2">
          <Text className="text-body-emph text-label-1">Cuentas</Text>
          <Text className="text-body text-label-2">
            Eres responsable de la información que registras y de mantener tu
            contraseña segura. Puedes pedir que se elimine tu cuenta en cualquier
            momento escribiendo a luis.sosa.4599@gmail.com.
          </Text>
        </View>

        <View className="gap-2">
          <Text className="text-body-emph text-label-1">Limitación de responsabilidad</Text>
          <Text className="text-body text-label-2">
            El autor de este proyecto no es responsable por decisiones tomadas con
            base en la información mostrada en la app, dado su carácter de
            demostración.
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
