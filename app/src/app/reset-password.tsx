import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Platform, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { AuthButton } from "@/components/auth/AuthButton";
import { AuthSpinner } from "@/components/auth/AuthSpinner";
import { AuthField, FieldHelp } from "@/components/auth/AuthField";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthBanner, AuthLink, AuthTopBar, StepHero } from "@/components/auth/AuthPieces";
import { ApiError } from "@/lib/api/client";
import { Check, Circle } from "@/lib/icons";
import { useIsOffline } from "@/lib/net";
import { useAuthStore } from "@/lib/session";
import { useColor } from "@/lib/theme/useColor";

const PASSWORD_MIN = 8;

const COPY = {
  passwordShort: (n: number) => `Usa al menos ${PASSWORD_MIN} caracteres. Llevas ${n}.`,
  offline: "Sin conexión. Conéctate a internet para continuar.",
  serverError: "Algo salió mal de nuestro lado. Inténtalo de nuevo en un momento.",
};

// "unknown": the check itself failed (offline, server down) — show the form
// anyway; saving re-validates the link and lands on K8 if it's dead.
type LinkState = "checking" | "valid" | "unknown" | "invalid";

// K5–K8 of the sign-in redesign: the landing route for the reset link in the
// email (or the __DEV__ shortcut from forgot-password). The link is checked
// as soon as the screen opens, so a dead one goes straight to K8 instead of
// after the user has typed a new password. Saving signs in right away.
export default function ResetPasswordScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const checkResetToken = useAuthStore((s) => s.checkResetToken);
  const resetPassword = useAuthStore((s) => s.resetPassword);
  const offline = useIsOffline();
  const tint = useColor("tint");
  const label3 = useColor("label-3");

  const [linkState, setLinkState] = useState<LinkState>(token ? "checking" : "invalid");
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [serverError, setServerError] = useState(false);
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    checkResetToken(token)
      .then((res) => {
        if (cancelled) return;
        setAccountEmail(res.email);
        setLinkState("valid");
      })
      .catch((e) => {
        if (cancelled) return;
        setLinkState(e instanceof ApiError && e.status === 400 ? "invalid" : "unknown");
      });
    return () => {
      cancelled = true;
    };
  }, [token, checkResetToken]);

  function leave() {
    if (router.canGoBack()) router.back();
    else router.replace("/sign-in");
  }

  async function submit() {
    if (!token || busy || offline) return;
    if (password.length < PASSWORD_MIN) {
      const message = COPY.passwordShort(password.length);
      setError(message);
      passwordRef.current?.focus();
      if (Platform.OS !== "web") AccessibilityInfo.announceForAccessibility(`Error: ${message}`);
      return;
    }
    setBusy(true);
    setServerError(false);
    try {
      await resetPassword(token, password);
      router.replace("/");
    } catch (e) {
      setBusy(false);
      // Expired while they were typing, or already used from another tab.
      if (e instanceof ApiError && e.status === 400) setLinkState("invalid");
      else setServerError(true);
    }
  }

  if (linkState === "checking") {
    return (
      <AuthLayout>
        <AuthTopBar kind="close" onPress={leave} />
        <View style={{ flexGrow: 1, alignItems: "center", justifyContent: "center", minHeight: 200 }}>
          <AuthSpinner color={label3} size={28} />
        </View>
      </AuthLayout>
    );
  }

  // ---- K8: the link no longer works ---------------------------------------------
  if (linkState === "invalid") {
    return (
      <AuthLayout>
        <AuthTopBar kind="close" onPress={leave} />
        <StepHero
          badge="clock"
          title="Este enlace ya no funciona"
          subtitle="Los enlaces vencen a los 30 minutos y solo sirven una vez. Pide uno nuevo y usa el correo más reciente."
        />
        <View style={{ gap: 16, marginTop: 32 }}>
          <AuthButton
            variant="primary"
            label="Pedir otro enlace"
            onPress={() => router.replace("/forgot-password")}
          />
          <AuthLink label="Volver a entrar" onPress={() => router.replace("/sign-in")} />
        </View>
      </AuthLayout>
    );
  }

  // ---- K5–K7: the new password ---------------------------------------------------
  const passwordOk = password.length >= PASSWORD_MIN;
  return (
    <AuthLayout>
      <AuthTopBar kind="close" onPress={leave} disabled={busy} />
      <StepHero title="Crea una nueva contraseña" subtitle="Al guardarla entrarás directo a la app." />
      <View style={{ gap: 16, marginTop: 32 }}>
        {offline ? (
          <AuthBanner kind="offline" text={COPY.offline} />
        ) : serverError ? (
          <AuthBanner kind="error" text={COPY.serverError} />
        ) : null}
        {/* Web: the account's email in a hidden username field, so the
            password manager saves the new password against the right login
            (handoff §10). */}
        {Platform.OS === "web" && accountEmail ? (
          <TextInput
            value={accountEmail}
            editable={false}
            autoComplete="username"
            importantForAccessibility="no"
            accessibilityElementsHidden
            style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
          />
        ) : null}
        <AuthField
          ref={passwordRef}
          label="Nueva contraseña"
          secure
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            setError(null);
          }}
          error={error}
          readOnly={busy}
          placeholder={`Mínimo ${PASSWORD_MIN} caracteres`}
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={submit}
          autoFocus
          help={
            <FieldHelp
              icon={passwordOk ? <Check size={16} color={tint} /> : <Circle size={16} color={label3} />}
              text={`Mínimo ${PASSWORD_MIN} caracteres`}
              accessibilityLabel={`Mínimo ${PASSWORD_MIN} caracteres, ${passwordOk ? "cumplido" : "no cumplido"}`}
            />
          }
        />
        <AuthButton
          variant="primary"
          label="Guardar y entrar"
          loadingLabel="Guardando…"
          loading={busy}
          disabled={offline}
          onPress={submit}
        />
      </View>
    </AuthLayout>
  );
}
