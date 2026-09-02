import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Placeholder } from "@/components/Placeholder";
import { Screen } from "@/components/Screen";
import { CalendarX } from "@/lib/icons";
import { useAuthStore } from "@/lib/session";

// Landing route for the magic link (real deep link, or the stub link from
// /auth/request-link). Verifies the token, then drops the user into Explore —
// no welcome screen, per the handoff.
export default function VerifyScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const verify = useAuthStore((s) => s.verify);
  const [verifyFailed, setVerifyFailed] = useState(false);
  const failed = !token || verifyFailed;

  useEffect(() => {
    if (!token) return;
    verify(token)
      .then(() => router.replace("/"))
      .catch(() => setVerifyFailed(true));
  }, [token, verify, router]);

  return (
    <Screen bg="card">
      <View className="flex-1 items-center justify-center px-6">
        {failed ? (
          <Placeholder
            reason="offline"
            icon={<CalendarX size={26} />}
            title="Enlace no válido"
            body="Este enlace expiró o ya se usó. Pide uno nuevo para entrar."
            primaryAction={{
              label: "Volver a entrar",
              onPress: () => router.replace("/sign-in"),
            }}
          />
        ) : (
          <Text className="text-body text-label-3">Entrando…</Text>
        )}
      </View>
    </Screen>
  );
}
