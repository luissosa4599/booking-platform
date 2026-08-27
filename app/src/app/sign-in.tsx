import { useState } from "react";
import { Platform, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { Button } from "@/components/Button";
import { ScreenFade } from "@/components/ScreenFade";
import { useAuthStore } from "@/lib/session";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function SignInScreen() {
  const router = useRouter();
  const requestLink = useAuthStore((s) => s.requestLink);
  const verify = useAuthStore((s) => s.verify);

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailValid = EMAIL_RE.test(email.trim());

  async function enterWith(address: string) {
    setBusy(true);
    setError(null);
    try {
      // Stub magic link: no mail is sent, so we verify the token right away —
      // matching the handoff's "el deep link entra directo a Explorar, sin
      // pantalla intermedia". A real deep link into /auth/verify still works.
      const { token } = await requestLink(address);
      await verify(token);
      router.replace("/");
    } catch {
      setError("No pudimos entrar. Revisa el correo e intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScreenFade>
      <View className="flex-1 bg-card">
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
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Correo institucional"
              placeholderTextColor="#8A8A8E"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              editable={!busy}
              onSubmitEditing={() => emailValid && enterWith(email.trim())}
              className="h-[52px] rounded-button bg-fill px-4 text-body text-label-1"
            />
            <Button
              variant="filled"
              disabled={!emailValid || busy}
              loading={busy}
              onPress={() => enterWith(email.trim())}
            >
              Continuar
            </Button>
            <Text className="text-footnote text-center text-label-4">
              Te enviamos un enlace. Sin contraseñas.
            </Text>
            {error ? (
              <Text className="text-footnote text-center text-state-error">
                {error}
              </Text>
            ) : null}
          </View>
        </View>

        <View className="gap-[10px] px-6 pb-[34px]">
          {/* App Store Review 4.8: Apple sign-in is required on iOS when other
              social logins exist; hidden elsewhere. Both are demo entries that
              sign in as a fixed account. */}
          {Platform.OS === "ios" ? (
            <Button
              variant="dark"
              disabled={busy}
              onPress={() => enterWith("apple-user@cupo.demo")}
            >
              Continuar con Apple
            </Button>
          ) : null}
          <Button
            variant="plain"
            disabled={busy}
            onPress={() => enterWith("google-user@cupo.demo")}
          >
            Continuar con Google
          </Button>
        </View>
      </View>
    </ScreenFade>
  );
}
