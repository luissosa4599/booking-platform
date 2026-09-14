import { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { Button } from "@/components/Button";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { Screen } from "@/components/Screen";
import { ApiError, apiFetch } from "@/lib/api/client";
import type { AvailabilitySlot } from "@/lib/api/types";
import { isGoogleAuthConfigured } from "@/lib/auth/google";
import { Eye, EyeOff } from "@/lib/icons";
import { useIsOffline } from "@/lib/net";
import { useAuthStore } from "@/lib/session";
import { stockImageUrl } from "@/lib/stockImages";
import { useColor } from "@/lib/theme/useColor";
import { useIsWide } from "@/lib/useBreakpoint";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const googleReady = isGoogleAuthConfigured();
const HERO_IMAGE = stockImageUrl("Sala de lectura", { width: 1040, height: 1300 });

type PasswordMode = "login" | "register";

// Redesign handoff §7.2 — "si la cifra no es calculable en tiempo real, se
// sustituye por el subtítulo del producto." Public endpoint (no auth needed
// pre-login) — sums `capacityRemaining` for slots overlapping the next hour,
// same "ahora" window Explore itself uses.
function useFreeNowCount() {
  return useQuery({
    queryKey: ["sign-in", "free-now-count"],
    queryFn: async () => {
      const now = new Date();
      const to = new Date(now.getTime() + 60 * 60_000);
      const res = await apiFetch<{ slots: AvailabilitySlot[] }>(
        `/availability?${new URLSearchParams({
          from: now.toISOString(),
          to: to.toISOString(),
        }).toString()}`,
      );
      return res.slots.reduce((sum, slot) => sum + slot.capacityRemaining, 0);
    },
    staleTime: 60_000,
    retry: false,
  });
}

export default function SignInScreen() {
  const router = useRouter();
  const requestLink = useAuthStore((s) => s.requestLink);
  const verify = useAuthStore((s) => s.verify);
  const loginWithPassword = useAuthStore((s) => s.loginWithPassword);
  const registerWithPassword = useAuthStore((s) => s.registerWithPassword);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordMode, setPasswordMode] = useState<PasswordMode>("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offline = useIsOffline();
  const iconColor = useColor("label-4");
  const isWide = useIsWide();
  const freeNowCount = useFreeNowCount();

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

  const form = (
    <View style={{ gap: 20 }}>
      {googleReady ? (
        <>
          <GoogleSignInButton
            busy={busy || offline}
            emphasis="primary"
            onBusyChange={setBusy}
            onError={setError}
          />
          <View className="flex-row items-center gap-3">
            <View className="h-px flex-1 bg-hairline" />
            <Text className="text-footnote text-label-4">o con tu correo</Text>
            <View className="h-px flex-1 bg-hairline" />
          </View>
        </>
      ) : null}

      <View style={{ gap: 12 }}>
        <View style={{ gap: 6 }}>
          <Text className="text-footnote font-semibold text-label-2">Correo</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="tu@correo.mx"
            placeholderTextColor="#8A8A8E"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            importantForAutofill="yes"
            editable={!busy}
            className="h-[52px] rounded-button border border-hairline bg-card px-4 text-body text-label-1"
          />
        </View>
        <View style={{ gap: 6 }}>
          <View className="flex-row items-center justify-between">
            <Text className="text-footnote font-semibold text-label-2">Contraseña</Text>
            {passwordMode === "login" ? (
              <Pressable
                disabled={busy}
                onPress={() => router.push("/forgot-password")}
                hitSlop={8}
              >
                <Text className="text-footnote text-label-3">¿La olvidaste?</Text>
              </Pressable>
            ) : null}
          </View>
          <View className="justify-center">
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#8A8A8E"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete={passwordMode === "login" ? "current-password" : "new-password"}
              textContentType={passwordMode === "login" ? "password" : "newPassword"}
              editable={!busy}
              onSubmitEditing={() => emailValid && passwordValid && submitPassword()}
              className="h-[52px] rounded-button border border-hairline bg-card px-4 pr-12 text-body text-label-1"
            />
            <Pressable
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={8}
              className="absolute right-3"
              accessibilityLabel={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPassword ? (
                <EyeOff size={20} color={iconColor} />
              ) : (
                <Eye size={20} color={iconColor} />
              )}
            </Pressable>
          </View>
        </View>
      </View>

      <Button
        variant={googleReady ? "gray" : "filled"}
        disabled={!emailValid || !passwordValid || busy || offline}
        loading={busy}
        onPress={submitPassword}
      >
        {passwordMode === "login" ? "Entrar" : "Crear cuenta"}
      </Button>

      {offline ? (
        <Text className="text-footnote text-center text-label-4">
          Necesitas conexión para entrar.
        </Text>
      ) : null}
      {error ? (
        <Text className="text-footnote text-center text-state-error">{error}</Text>
      ) : null}
    </View>
  );

  const footer = (
    <View style={{ gap: 20, marginTop: "auto" }}>
      <View className="flex-row items-center justify-center">
        <Pressable
          disabled={busy}
          onPress={() => {
            setError(null);
            setPasswordMode((m) => (m === "login" ? "register" : "login"));
          }}
          hitSlop={8}
        >
          <Text className="text-footnote text-label-3">
            {passwordMode === "login" ? "¿No tienes cuenta? " : "¿Ya tienes cuenta? "}
            <Text className="font-semibold text-tint">
              {passwordMode === "login" ? "Crear una" : "Entra"}
            </Text>
          </Text>
        </Pressable>
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

      {/* App Store Review 4.8: Apple sign-in is required on iOS when other
            social logins exist. Wired as a dev demo entry for now — a real
            Sign in with Apple flow is out of scope for this pass. */}
      {__DEV__ && Platform.OS === "ios" ? (
        <Button
          variant="dark"
          disabled={busy}
          onPress={() => continueWithDevLink("apple-user@tempo.demo")}
        >
          Continuar con Apple
        </Button>
      ) : null}
    </View>
  );

  const brand = (
    <View style={{ gap: 16 }}>
      <View className="h-[60px] w-[60px] items-center justify-center rounded-logo bg-tint">
        <View className="h-[22px] w-[22px] rounded-[7px] bg-on-tint" />
      </View>
      <View style={{ gap: 8 }}>
        <Text
          className="text-label-1"
          style={{ fontFamily: "SpaceGrotesk_700Bold", fontSize: 34, letterSpacing: -0.6 }}
        >
          Aparta tu lugar.
        </Text>
        <Text className="text-body text-label-3">
          Salones, cubículos y salas de lectura de tu campus. Un tap y es tuyo.
        </Text>
      </View>
    </View>
  );

  if (isWide) {
    const heroTitle =
      freeNowCount.data != null
        ? `${freeNowCount.data.toLocaleString("es-MX")} lugares libres ahora mismo en tu campus`
        : "Salones, cubículos y salas de lectura de tu campus";

    return (
      <Screen bg="card" fluid>
        <View style={{ flex: 1, flexDirection: "row" }}>
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 48 }}>
            <View style={{ width: 420, gap: 28 }}>
              {brand}
              {form}
              {footer}
            </View>
          </View>

          <View style={{ width: 520 }}>
            <Image source={{ uri: HERO_IMAGE }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
            <View
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: 320,
                justifyContent: "flex-end",
                paddingHorizontal: 36,
                paddingBottom: 36,
                // Taller than the text block on purpose — the darkest stop
                // needs to sit well past where the subtitle ends, or a
                // bright patch of photo right behind the second line reads
                // as low-contrast regardless of the darkest color used.
                backgroundImage:
                  "linear-gradient(to top, rgba(11,11,12,0.85) 0%, rgba(11,11,12,0.55) 45%, rgba(11,11,12,0) 100%)",
              }}
            >
              <Text
                style={{ color: "#FFFFFF", fontSize: 28, fontWeight: "700", letterSpacing: -0.5 }}
              >
                {heroTitle}
              </Text>
              <Text className="text-on-tint-sub" style={{ fontSize: 15, marginTop: 10 }}>
                UNAM · IPN · reservas por horas
              </Text>
            </View>
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen bg="card" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        // "height" (not "padding"/undefined) on Android — Expo SDK 57's
        // edge-to-edge default breaks the native adjustResize keyboard
        // behavior, so the keyboard covered the password field on a real
        // device without this (2026-09-14). Verify again on a real build.
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View style={{ flex: 1, gap: 32, paddingHorizontal: 24, paddingVertical: 40 }}>
          {brand}
          {form}
          {footer}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
