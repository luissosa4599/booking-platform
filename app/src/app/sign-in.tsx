import { useState } from "react";
import { Platform, Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { Button } from "@/components/Button";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { Screen } from "@/components/Screen";
import { ApiError } from "@/lib/api/client";
import { isGoogleAuthConfigured } from "@/lib/auth/google";
import { useIsOffline } from "@/lib/net";
import { useAuthStore } from "@/lib/session";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const googleReady = isGoogleAuthConfigured();

type PasswordMode = "login" | "register";

export default function SignInScreen() {
  const router = useRouter();
  const requestLink = useAuthStore((s) => s.requestLink);
  const verify = useAuthStore((s) => s.verify);
  const loginWithPassword = useAuthStore((s) => s.loginWithPassword);
  const registerWithPassword = useAuthStore((s) => s.registerWithPassword);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordMode, setPasswordMode] = useState<PasswordMode>("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offline = useIsOffline();

  const emailValid = EMAIL_RE.test(email.trim());
  const passwordValid = password.length >= 8;

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

  async function submitPassword() {
    setBusy(true);
    setError(null);
    try {
      if (passwordMode === "login") {
        await loginWithPassword(email, password);
      } else {
        await registerWithPassword(email, password);
      }
      router.replace("/");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setError("Correo o contraseña incorrectos.");
      } else if (e instanceof ApiError && e.status === 409) {
        setError("Ya existe una cuenta con este correo.");
      } else if (e instanceof ApiError && e.status === 400) {
        setError("Revisa el correo y la contraseña (mínimo 8 caracteres).");
      } else {
        setError("No pudimos entrar. Intenta de nuevo.");
      }
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
          <Text className="text-title-lg text-label-1">Aparta tu lugar.</Text>
          <Text className="text-body text-label-3">
            Salas, cabinas y escritorios. Un tap y es tuyo.
          </Text>
        </View>

        <View className="gap-3">
          {googleReady ? (
            <GoogleSignInButton
              busy={busy || offline}
              emphasis="primary"
              onBusyChange={setBusy}
              onError={setError}
            />
          ) : null}

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
            className="h-[52px] rounded-button bg-fill px-4 text-body text-label-1"
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Contraseña"
            placeholderTextColor="#8A8A8E"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete={passwordMode === "login" ? "current-password" : "new-password"}
            textContentType={passwordMode === "login" ? "password" : "newPassword"}
            editable={!busy}
            onSubmitEditing={() =>
              emailValid && passwordValid && submitPassword()
            }
            className="h-[52px] rounded-button bg-fill px-4 text-body text-label-1"
          />
          <Button
            variant={googleReady ? "gray" : "filled"}
            disabled={!emailValid || !passwordValid || busy || offline}
            loading={busy}
            onPress={submitPassword}
          >
            {passwordMode === "login" ? "Entrar" : "Crear cuenta"}
          </Button>

          <View className="flex-row items-center justify-between">
            <Pressable
              disabled={busy}
              onPress={() => {
                setError(null);
                setPasswordMode((m) => (m === "login" ? "register" : "login"));
              }}
              hitSlop={8}
            >
              <Text className="text-footnote text-tint">
                {passwordMode === "login" ? "Crear una cuenta" : "Ya tengo cuenta"}
              </Text>
            </Pressable>
            {passwordMode === "login" ? (
              <Pressable
                disabled={busy}
                onPress={() => router.push("/forgot-password")}
                hitSlop={8}
              >
                <Text className="text-footnote text-label-3">
                  ¿Olvidaste tu contraseña?
                </Text>
              </Pressable>
            ) : null}
          </View>

          {__DEV__ ? (
            <Button
              variant="plain"
              disabled={!emailValid || busy || offline}
              loading={busy}
              onPress={() => continueWithDevLink(email.trim())}
            >
              Entrar con enlace de dev
            </Button>
          ) : null}

          {offline ? (
            <Text className="text-footnote text-center text-label-4">
              Necesitas conexión para entrar.
            </Text>
          ) : null}
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
