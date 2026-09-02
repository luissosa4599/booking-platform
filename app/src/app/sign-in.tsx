import { useState } from "react";
import { Platform, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { Button } from "@/components/Button";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { Screen } from "@/components/Screen";
import { isGoogleAuthConfigured } from "@/lib/auth/google";
import { useAuthStore } from "@/lib/session";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const googleReady = isGoogleAuthConfigured();

export default function SignInScreen() {
  const router = useRouter();
  const requestLink = useAuthStore((s) => s.requestLink);
  const verify = useAuthStore((s) => s.verify);

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailValid = EMAIL_RE.test(email.trim());

  // Dev-only: no mail is sent, so we verify the token right away. The
  // /auth/request-link + /auth/verify endpoints only exist in Development.
  async function continueWithDevLink(address: string) {
    setBusy(true);
    setError(null);
    try {
      const { token } = await requestLink(address);
      await verify(token);
      router.replace("/");
    } catch {
      setError("No pudimos entrar. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen bg="card" edges={["top", "bottom"]}>
      <View className="flex-1 justify-center gap-10 px-6">
        <View className="h-[60px] w-[60px] items-center justify-center rounded-logo bg-tint">
          <View className="h-[22px] w-[22px] rounded-[7px] bg-on-tint" />
        </View>

        <View className="gap-3">
          <Text className="text-title-lg text-label-1">
            Aparta tu lugar{"\n"}en la biblioteca.
          </Text>
          <Text className="text-body text-label-3">
            Salas, cabinas y escritorios. Un tap y es tuyo por 90 minutos.
          </Text>
        </View>

        <View className="gap-3">
          {googleReady ? (
            <GoogleSignInButton
              busy={busy}
              emphasis="primary"
              onBusyChange={setBusy}
              onError={setError}
            />
          ) : null}

          {__DEV__ ? (
            <>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Correo (solo dev)"
                placeholderTextColor="#8A8A8E"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                importantForAutofill="yes"
                editable={!busy}
                onSubmitEditing={() =>
                  emailValid && continueWithDevLink(email.trim())
                }
                className="h-[52px] rounded-button bg-fill px-4 text-body text-label-1"
              />
              <Button
                variant={googleReady ? "gray" : "filled"}
                disabled={!emailValid || busy}
                loading={busy}
                onPress={() => continueWithDevLink(email.trim())}
              >
                Entrar con enlace de dev
              </Button>
            </>
          ) : null}

          <Text className="text-footnote text-center text-label-4">
            Sin contraseñas.
          </Text>
          {error ? (
            <Text className="text-footnote text-center text-state-error">
              {error}
            </Text>
          ) : null}
        </View>
      </View>

      {/* App Store Review 4.8: Apple sign-in is required on iOS when other
            social logins exist. Wired as a dev demo entry for now — a real
            Sign in with Apple flow is out of scope for this pass. */}
      {__DEV__ && Platform.OS === "ios" ? (
        <View className="gap-[10px] px-6 pb-4">
          <Button
            variant="dark"
            disabled={busy}
            onPress={() => continueWithDevLink("apple-user@tempo.demo")}
          >
            Continuar con Apple
          </Button>
        </View>
      ) : null}
    </Screen>
  );
}
