import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Button } from "@/components/Button";
import { Placeholder } from "@/components/Placeholder";
import { Screen } from "@/components/Screen";
import { ApiError } from "@/lib/api/client";
import { CalendarX } from "@/lib/icons";
import { useIsOffline } from "@/lib/net";
import { useAuthStore } from "@/lib/session";

// Landing route for the forgot-password link (real email, or the __DEV__
// shortcut from forgot-password.tsx). Sets a new password and signs in
// immediately on success, same as register/login.
export default function ResetPasswordScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const resetPassword = useAuthStore((s) => s.resetPassword);
  const offline = useIsOffline();

  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [invalidToken, setInvalidToken] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordValid = password.length >= 8;

  async function submit() {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await resetPassword(token, password);
      router.replace("/");
    } catch (e) {
      if (e instanceof ApiError && e.status === 400) {
        setInvalidToken(true);
      } else {
        setError("No pudimos actualizar tu contraseña. Intenta de nuevo.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (!token || invalidToken) {
    return (
      <Screen bg="card">
        <View className="flex-1 items-center justify-center px-6">
          <Placeholder
            reason="offline"
            icon={<CalendarX size={26} />}
            title="Enlace no válido"
            body="Este enlace expiró o ya se usó. Pide uno nuevo para continuar."
            primaryAction={{
              label: "Pedir un enlace nuevo",
              onPress: () => router.replace("/forgot-password"),
            }}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen bg="card" edges={["top", "bottom"]}>
      <View className="flex-1 justify-center gap-6 px-6">
        <View className="gap-3">
          <Text className="text-title-lg text-label-1">
            Elige una nueva contraseña
          </Text>
          <Text className="text-body text-label-3">
            Mínimo 8 caracteres.
          </Text>
        </View>

        <View className="gap-3">
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Nueva contraseña"
            placeholderTextColor="#8A8A8E"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            editable={!busy}
            onSubmitEditing={() => passwordValid && submit()}
            className="h-[52px] rounded-button bg-fill px-4 text-body text-label-1"
          />
          <Button
            disabled={!passwordValid || busy || offline}
            loading={busy}
            onPress={submit}
          >
            Guardar contraseña
          </Button>
          {offline ? (
            <Text className="text-footnote text-center text-label-4">
              Necesitas conexión para continuar.
            </Text>
          ) : null}
          {error ? (
            <Text className="text-footnote text-center text-state-error">
              {error}
            </Text>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}
