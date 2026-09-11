import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { useIsOffline } from "@/lib/net";
import { useAuthStore } from "@/lib/session";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Requests a password-reset link. The server's response is always the same
// generic message regardless of whether the email has an account — never
// leak that here either. __DEV__ gets a shortcut straight to the reset
// screen (no mail sender wired for local testing, see AuthEndpoints).
export default function ForgotPasswordScreen() {
  const router = useRouter();
  const forgotPassword = useAuthStore((s) => s.forgotPassword);
  const offline = useIsOffline();

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [debugToken, setDebugToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const emailValid = EMAIL_RE.test(email.trim());

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const result = await forgotPassword(email);
      setSent(true);
      setDebugToken(result.debugToken ?? null);
    } catch {
      setError("No pudimos procesar tu solicitud. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen bg="card" edges={["top", "bottom"]}>
      <View className="flex-1 justify-center gap-6 px-6">
        <View className="gap-3">
          <Text className="text-title-lg text-label-1">
            Recupera tu contraseña
          </Text>
          <Text className="text-body text-label-3">
            {sent
              ? "Si ese correo tiene una cuenta, te enviamos un enlace para continuar."
              : "Escribe tu correo y te enviamos un enlace para restablecerla."}
          </Text>
        </View>

        {!sent ? (
          <View className="gap-3">
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Correo"
              placeholderTextColor="#8A8A8E"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              importantForAutofill="yes"
              editable={!busy}
              onSubmitEditing={() => emailValid && submit()}
              className="h-[52px] rounded-button bg-fill px-4 text-body text-label-1"
            />
            <Button
              disabled={!emailValid || busy || offline}
              loading={busy}
              onPress={submit}
            >
              Enviar enlace
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
        ) : (
          <View className="gap-3">
            {__DEV__ && debugToken ? (
              <Button
                variant="plain"
                onPress={() =>
                  router.replace({
                    pathname: "/reset-password",
                    params: { token: debugToken },
                  })
                }
              >
                Continuar (solo dev, sin correo real)
              </Button>
            ) : null}
            <Button variant="gray" onPress={() => router.replace("/sign-in")}>
              Volver a entrar
            </Button>
          </View>
        )}
      </View>
    </Screen>
  );
}
