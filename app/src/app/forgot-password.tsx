import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Platform, Text, View, type TextInput } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { AuthButton } from "@/components/auth/AuthButton";
import { AuthField } from "@/components/auth/AuthField";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthBanner, AuthCaption, AuthLink, AuthTopBar, StepHero } from "@/components/auth/AuthPieces";
import { useIsOffline } from "@/lib/net";
import { useAuthStore } from "@/lib/session";
import { useColor } from "@/lib/theme/useColor";
import { useEnterAnimation } from "@/lib/useEnterAnimation";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
// Handoff K4 — "Reenviar enlace" unlocks after this long.
const RESEND_COOLDOWN_S = 45;

const COPY = {
  emailEmpty: "Escribe tu correo.",
  emailInvalid: "Revisa tu correo. Debe verse como nombre@dominio.mx.",
  offline: "Sin conexión. Conéctate a internet para continuar.",
  serverError: "Algo salió mal de nuestro lado. Inténtalo de nuevo en un momento.",
};

function formatCountdown(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

// K1–K4 of the sign-in redesign. The server answers the same thing whether
// or not the email has an account, and so does K4 — never leak which emails
// are registered here. __DEV__ gets a shortcut straight to the reset screen
// (no mail is sent locally, see AuthEndpoints).
export default function ForgotPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const forgotPassword = useAuthStore((s) => s.forgotPassword);
  const offline = useIsOffline();
  const label1 = useColor("label-1");

  const [email, setEmail] = useState(params.email ?? "");
  const [error, setError] = useState<string | null>(null);
  const [serverError, setServerError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [debugToken, setDebugToken] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const emailRef = useRef<TextInput>(null);
  const pageEnter = useEnterAnimation(sentTo ? "sent" : "form", { translateX: 24, duration: 280, onMount: false });

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  function backToSignIn() {
    if (router.canGoBack()) router.back();
    else router.replace("/sign-in");
  }

  async function send(address: string) {
    setBusy(true);
    setServerError(false);
    try {
      const result = await forgotPassword(address);
      setDebugToken(result.debugToken ?? null);
      setSentTo(address);
      setResendIn(RESEND_COOLDOWN_S);
      if (Platform.OS !== "web") {
        AccessibilityInfo.announceForAccessibility(
          `Revisa tu correo. Si hay una cuenta con ${address}, te enviamos un enlace para crear una nueva contraseña. Vence en 30 minutos.`,
        );
      }
    } catch {
      setServerError(true);
    } finally {
      setBusy(false);
    }
  }

  function submit() {
    if (busy || offline) return;
    const trimmed = email.trim();
    const next = !trimmed ? COPY.emailEmpty : !EMAIL_RE.test(trimmed) ? COPY.emailInvalid : null;
    setError(next);
    if (next) {
      emailRef.current?.focus();
      if (Platform.OS !== "web") AccessibilityInfo.announceForAccessibility(`Error: ${next}`);
      return;
    }
    void send(trimmed);
  }

  const banner = offline ? (
    <AuthBanner kind="offline" text={COPY.offline} />
  ) : serverError ? (
    <AuthBanner kind="error" text={COPY.serverError} />
  ) : null;

  // ---- K4: check your email --------------------------------------------------
  if (sentTo) {
    return (
      <AuthLayout>
        <Animated.View style={pageEnter}>
          <AuthTopBar kind="close" onPress={backToSignIn} />
          <StepHero
            badge="mail"
            title="Revisa tu correo"
            subtitle={
              <>
                Si hay una cuenta con{" "}
                <Text style={{ fontWeight: "600", color: label1 }}>{sentTo}</Text>, te enviamos
                un enlace para crear una nueva contraseña. Vence en 30 minutos.
              </>
            }
          />
          <View style={{ gap: 16, marginTop: 32 }}>
            {banner}
            <AuthButton variant="primary" label="Volver a entrar" onPress={backToSignIn} />
            <View style={{ gap: 4 }}>
              <AuthCaption>¿No llega? Revisa spam o promociones.</AuthCaption>
              <AuthLink
                label={
                  resendIn > 0
                    ? `Reenviar enlace en ${formatCountdown(resendIn)}`
                    : busy
                      ? "Enviando…"
                      : "Reenviar enlace"
                }
                accessibilityLabel={
                  resendIn > 0 ? `Reenviar enlace, disponible en ${resendIn} segundos` : undefined
                }
                disabled={resendIn > 0 || busy || offline}
                onPress={() => void send(sentTo)}
              />
            </View>
            {__DEV__ && debugToken ? (
              <AuthLink
                label="Continuar (solo dev, sin correo real)"
                onPress={() =>
                  router.replace({ pathname: "/reset-password", params: { token: debugToken } })
                }
              />
            ) : null}
          </View>
        </Animated.View>
      </AuthLayout>
    );
  }

  // ---- K1–K3: ask for the link -------------------------------------------------
  return (
    <AuthLayout>
      <Animated.View style={pageEnter}>
        <AuthTopBar kind="back" onPress={backToSignIn} disabled={busy} />
        <StepHero
          title="¿Olvidaste tu contraseña?"
          subtitle="Escribe tu correo y te enviaremos un enlace para crear una nueva."
        />
        <View style={{ gap: 16, marginTop: 32 }}>
          {banner}
          <AuthField
            ref={emailRef}
            label="Correo"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setError(null);
            }}
            error={error}
            readOnly={busy}
            placeholder="tu@correo.mx"
            keyboardType="email-address"
            inputMode="email"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={submit}
            autoFocus={!params.email}
          />
          <AuthButton
            variant="primary"
            label="Enviar enlace"
            loadingLabel="Enviando…"
            loading={busy}
            disabled={offline}
            onPress={submit}
          />
        </View>
      </Animated.View>
    </AuthLayout>
  );
}
