import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  BackHandler,
  Platform,
  Pressable,
  Text,
  View,
  useWindowDimensions,
  type TextInput,
} from "react-native";
import { useRouter } from "expo-router";

import { AuthButton } from "@/components/auth/AuthButton";
import { AuthField, FieldHelp } from "@/components/auth/AuthField";
import { AuthLayout, useAuthSplit } from "@/components/auth/AuthLayout";
import {
  AuthBanner,
  AuthCaption,
  AuthFooter,
  AuthLink,
  AuthTopBar,
  BrandHero,
  EmailCard,
  StepHero,
} from "@/components/auth/AuthPieces";
import { authType } from "@/components/auth/authType";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { ApiError, apiErrorCode } from "@/lib/api/client";
import { isGoogleAuthConfigured } from "@/lib/auth/google";
import { AtSign, Check, Circle } from "@/lib/icons";
import { useIsOffline } from "@/lib/net";
import { useAuthStore } from "@/lib/session";
import { useColor } from "@/lib/theme/useColor";
import { useEnterAnimation } from "@/lib/useEnterAnimation";
import { useKeyboardHeight } from "@/lib/useKeyboard";

// Sign-in redesign 2026-10-06 — direction 1a "Dos puertas" (Claude Design
// handoff, "Mejora del login de app"). One screen, four steps:
//   doors  (A, or H for a guest) — Google / correo, side by side
//   email  (B) — one form for signing in AND signing up
//   create (F) — the email had no account: confirm it, ask for a name
//   google (G) — the email belongs to a Google account (no password)
// An account is never created without F: a typo'd email would otherwise
// silently become a brand-new empty account.
type Step = "doors" | "email" | "create" | "google";
type Busy = "login" | "create" | "google" | null;
interface FieldErrors {
  email?: string;
  password?: string;
  name?: string;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const NAME_MAX = 60;
const PASSWORD_MIN = 8;
const googleReady = isGoogleAuthConfigured();

const COPY = {
  subtitle: "Salones, cubículos y salas de lectura de tu campus. Un tap y es tuyo.",
  guestSubtitle: "Inicia sesión o crea tu cuenta para usar esta función.",
  firstTime: "¿Primera vez? Elige una opción y crea tu cuenta en un paso.",
  splitTitle: "Entra o crea tu cuenta",
  emailEmpty: "Escribe tu correo.",
  emailInvalid: "Revisa tu correo. Debe verse como nombre@dominio.mx.",
  passwordEmpty: "Escribe tu contraseña.",
  wrongPassword: "La contraseña no es correcta. Inténtalo de nuevo o recupérala.",
  nameEmpty: "Escribe tu nombre.",
  passwordShort: (n: number) => `Usa al menos ${PASSWORD_MIN} caracteres. Llevas ${n}.`,
  offline: "Sin conexión. Conéctate a internet para entrar.",
  offlineContinue: "Sin conexión. Conéctate a internet para continuar.",
  serverError: "Algo salió mal de nuestro lado. Inténtalo de nuevo en un momento.",
};

const BACK_FROM: Record<Step, Step | null> = {
  doors: null,
  email: "doors",
  create: "email",
  google: "email",
};

/** Native screen readers; on web the error text's aria-live region speaks. */
function announce(messages: (string | undefined)[]) {
  const present = messages.filter((m): m is string => !!m);
  if (present.length === 0 || Platform.OS === "web") return;
  AccessibilityInfo.announceForAccessibility(
    present.length > 1 ? `${present.length} errores. ${present[0]}` : `Error: ${present[0]}`,
  );
}

export default function SignInScreen() {
  const router = useRouter();
  const loginWithPassword = useAuthStore((s) => s.loginWithPassword);
  const registerWithPassword = useAuthStore((s) => s.registerWithPassword);
  const enterGuestMode = useAuthStore((s) => s.enterGuestMode);
  // H: a guest who came here from "tienes que iniciar sesión" — they're
  // already browsing, so no "Explorar sin cuenta"; an X takes them back.
  const isGuest = useAuthStore((s) => !s.session && s.guest);
  const offline = useIsOffline();
  const split = useAuthSplit();
  const { height: windowHeight } = useWindowDimensions();
  const keyboardHeight = useKeyboardHeight();
  const tint = useColor("tint");
  const label3 = useColor("label-3");
  const label1 = useColor("label-1");
  const disabledLabel = useColor("disabled-label");

  const [step, setStep] = useState<Step>("doors");
  // Doors ↔ email only swaps the block under the hero (it stays put);
  // anything touching create/google slides the whole page (handoff §8).
  const [transition, setTransition] = useState<{ kind: "block" | "page"; forward: boolean }>({
    kind: "block",
    forward: true,
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  // "Corregir"/"Cambiar" land back on B with the email field focused.
  const [focusEmail, setFocusEmail] = useState(false);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const nameRef = useRef<TextInput>(null);
  const newPasswordRef = useRef<TextInput>(null);

  const blockEnter = useEnterAnimation(step, { translateY: 16, duration: 250, onMount: false });
  const pageEnter = useEnterAnimation(step, {
    translateX: transition.forward ? 24 : -24,
    duration: transition.forward ? 280 : 250,
    onMount: false,
  });

  function goTo(next: Step, options: { focusEmail?: boolean } = {}) {
    const page = [step, next].some((s) => s === "create" || s === "google");
    setTransition({
      kind: page ? "page" : "block",
      forward: BACK_FROM[step] !== next,
    });
    setFocusEmail(options.focusEmail ?? false);
    setErrors({});
    setServerError(false);
    setStep(next);
  }

  // Android's back button walks the steps back (and does nothing mid-request,
  // handoff D1) before it ever leaves the screen.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (busy) return true;
      const previous = BACK_FROM[step];
      if (!previous) return false;
      setTransition({ kind: step === "email" ? "block" : "page", forward: false });
      setFocusEmail(false);
      setErrors({});
      setServerError(false);
      setStep(previous);
      return true;
    });
    return () => sub.remove();
  }, [busy, step]);

  function back() {
    const previous = BACK_FROM[step];
    if (previous) goTo(previous);
  }

  // Back to wherever the guest was (they reached this from the sign-in modal),
  // or Explore on a first launch.
  function continueAsGuest() {
    enterGuestMode();
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }

  function forgotPassword(prefill: string) {
    const trimmed = prefill.trim();
    router.push({
      pathname: "/forgot-password",
      params: EMAIL_RE.test(trimmed) ? { email: trimmed } : {},
    });
  }

  function clearError(field: keyof FieldErrors) {
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }

  // B — validate everything at once on tap (never while typing), then ask the
  // server, which says which of four outcomes it is.
  async function submitLogin() {
    if (busy || offline) return;
    const trimmed = email.trim();
    const next: FieldErrors = {};
    if (!trimmed) next.email = COPY.emailEmpty;
    else if (!EMAIL_RE.test(trimmed)) next.email = COPY.emailInvalid;
    // No 8-character minimum here: existing accounts decide on the server.
    if (!password) next.password = COPY.passwordEmpty;
    setErrors(next);
    setServerError(false);
    if (next.email || next.password) {
      (next.email ? emailRef : passwordRef).current?.focus();
      announce([next.email, next.password]);
      return;
    }

    setBusy("login");
    try {
      await loginWithPassword(trimmed, password);
      // No navigation here — the AuthGate moves a fresh session off this
      // screen (back to wherever the guest was, or home). `busy` stays set
      // so a second tap in between does nothing.
    } catch (e) {
      setBusy(null);
      if (e instanceof ApiError && e.status === 401) {
        const code = apiErrorCode(e);
        if (code === "no_account") {
          goTo("create");
        } else if (code === "google_account") {
          goTo("google");
        } else {
          setErrors({ password: COPY.wrongPassword });
          passwordRef.current?.focus();
          announce([COPY.wrongPassword]);
        }
        return;
      }
      // Timeout (15 s), 5xx, no route to the server — retry with Entrar.
      setServerError(true);
    }
  }

  // F — the only place an email account gets created.
  async function submitCreate() {
    if (busy || offline) return;
    const cleanName = name.trim().replace(/\s+/g, " ");
    const next: FieldErrors = {};
    if (!cleanName) next.name = COPY.nameEmpty;
    if (password.length < PASSWORD_MIN) next.password = COPY.passwordShort(password.length);
    setErrors(next);
    setServerError(false);
    if (next.name || next.password) {
      (next.name ? nameRef : newPasswordRef).current?.focus();
      announce([next.name, next.password]);
      return;
    }

    setBusy("create");
    try {
      await registerWithPassword(email.trim(), password, cleanName);
    } catch (e) {
      const code = apiErrorCode(e);
      if (code === "google_account") {
        setBusy(null);
        goTo("google");
        return;
      }
      if (code === "email_taken") {
        // Created in the meantime (another tab/device) — this password may
        // well be the one it was created with.
        try {
          await loginWithPassword(email.trim(), password);
          return;
        } catch {
          setBusy(null);
          goTo("email");
          setErrors({ password: COPY.wrongPassword });
          return;
        }
      }
      setBusy(null);
      setServerError(true);
    }
  }

  const banner = offline ? (
    <AuthBanner
      kind="offline"
      text={step === "create" || step === "google" ? COPY.offlineContinue : COPY.offline}
    />
  ) : serverError ? (
    <AuthBanner kind="error" text={COPY.serverError} />
  ) : null;

  const google = googleReady ? (
    <GoogleSignInButton
      loading={busy === "google"}
      disabled={offline || (busy !== null && busy !== "google")}
      onLoadingChange={(loading) => setBusy(loading ? "google" : null)}
      onError={() => setServerError(true)}
    />
  ) : null;

  // ---- A / H: the two doors -------------------------------------------------
  function renderDoors() {
    const buttons = (
      <View style={{ gap: 16 }}>
        {banner}
        <View style={{ gap: 12 }}>
          {google}
          <AuthButton
            variant="secondary"
            label="Continuar con correo"
            icon={<AtSign size={20} color={busy ? disabledLabel : label1} />}
            disabled={busy !== null}
            onPress={() => goTo("email")}
          />
        </View>
        <AuthCaption>{COPY.firstTime}</AuthCaption>
      </View>
    );
    const footer = (
      <AuthFooter showGuest={!isGuest} onGuest={continueAsGuest} guestDisabled={busy !== null} />
    );

    if (split) {
      return (
        <View>
          {isGuest ? (
            <AuthTopBar kind="close" onPress={close} accessibilityLabel="Cerrar y volver" />
          ) : null}
          <StepHero title={COPY.splitTitle} subtitle={isGuest ? COPY.guestSubtitle : undefined} />
          <Animated.View style={[{ marginTop: 32 }, blockEnter]}>
            {buttons}
            {footer}
          </Animated.View>
        </View>
      );
    }

    return (
      <>
        {/* An empty bar on A keeps the hero exactly where B has it, so the
            doors → form swap only moves the block underneath. */}
        <AuthTopBar
          kind={isGuest ? "close" : "none"}
          onPress={close}
          accessibilityLabel="Cerrar y volver"
        />
        <BrandHero subtitle={isGuest ? COPY.guestSubtitle : COPY.subtitle} />
        <View style={{ flexGrow: 1, minHeight: 24 }} />
        <Animated.View style={blockEnter}>
          {buttons}
          {footer}
        </Animated.View>
      </>
    );
  }

  // ---- B: email + password --------------------------------------------------
  function renderEmail() {
    // I — on a short screen (or a tall keyboard) the hero gives its room to
    // the form; on a tall one only the subtitle goes.
    const keyboardOpen = !split && keyboardHeight > 0;
    const compact = keyboardOpen && (keyboardHeight > windowHeight * 0.3 || windowHeight < 700);
    const loading = busy === "login";

    const form = (
      <View style={{ gap: 16 }}>
        {banner}
        <AuthField
          ref={emailRef}
          label="Correo"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            clearError("email");
          }}
          error={errors.email}
          readOnly={loading}
          placeholder="tu@correo.mx"
          keyboardType="email-address"
          inputMode="email"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
          autoFocus={focusEmail}
        />
        <AuthField
          ref={passwordRef}
          label="Contraseña"
          secure
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            clearError("password");
          }}
          error={errors.password}
          readOnly={loading}
          placeholder="Tu contraseña"
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={submitLogin}
          labelAccessory={
            <Pressable
              onPress={() => forgotPassword(email)}
              disabled={loading}
              accessibilityRole="button"
              accessibilityState={{ disabled: loading }}
              // The 20px text reaches the 48px target through hitSlop.
              hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
            >
              <Text style={[authType.label, { color: loading ? disabledLabel : tint }]}>
                ¿La olvidaste?
              </Text>
            </Pressable>
          }
        />
        <AuthButton
          variant="primary"
          label="Entrar"
          loadingLabel="Entrando…"
          loading={loading}
          disabled={offline}
          onPress={submitLogin}
        />
      </View>
    );

    if (split) {
      return (
        <View>
          <AuthTopBar kind="back" onPress={back} disabled={loading} />
          <StepHero title={COPY.splitTitle} />
          <Animated.View style={[{ marginTop: 32 }, transition.kind === "block" ? blockEnter : null]}>
            {form}
          </Animated.View>
        </View>
      );
    }

    return (
      <>
        <AuthTopBar
          kind="back"
          onPress={back}
          disabled={loading}
          title={compact ? "Entrar con correo" : undefined}
        />
        {compact ? null : (
          <BrandHero
            subtitle={isGuest ? COPY.guestSubtitle : COPY.subtitle}
            showSubtitle={!keyboardOpen}
          />
        )}
        <View style={compact ? { height: 16 } : { flexGrow: 1, minHeight: 24 }} />
        <Animated.View style={transition.kind === "block" ? blockEnter : undefined}>
          {form}
        </Animated.View>
      </>
    );
  }

  // ---- F: confirm the new account -------------------------------------------
  function renderCreate() {
    const loading = busy === "create";
    const passwordOk = password.length >= PASSWORD_MIN;
    return (
      <View>
        <AuthTopBar kind="back" onPress={back} disabled={loading} />
        <StepHero
          title="Crea tu cuenta"
          subtitle="No encontramos una cuenta con este correo. Revisa que esté bien escrito:"
        />
        <View style={{ gap: 16, marginTop: 32 }}>
          {banner}
          <EmailCard
            email={email.trim()}
            actionLabel="Corregir"
            actionAccessibilityLabel={`Corregir correo ${email.trim()}`}
            disabled={loading}
            onAction={() => goTo("email", { focusEmail: true })}
          />
          <AuthField
            ref={nameRef}
            label="Nombre"
            value={name}
            onChangeText={(text) => {
              setName(text);
              clearError("name");
            }}
            error={errors.name}
            readOnly={loading}
            placeholder="Cómo quieres que te vean"
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            maxLength={NAME_MAX}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => newPasswordRef.current?.focus()}
            autoFocus
            help={
              <FieldHelp
                text="Así aparecerás en la app."
                trailing={
                  <Text
                    style={[authType.help, { color: label3, fontVariant: ["tabular-nums"] }]}
                    accessibilityLabel={`${name.length} de ${NAME_MAX} caracteres`}
                  >
                    {name.length}/{NAME_MAX}
                  </Text>
                }
              />
            }
          />
          <AuthField
            ref={newPasswordRef}
            label="Contraseña"
            secure
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              clearError("password");
            }}
            error={errors.password}
            readOnly={loading}
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={submitCreate}
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
            label="Crear cuenta"
            loadingLabel="Creando cuenta…"
            loading={loading}
            disabled={offline}
            onPress={submitCreate}
          />
        </View>
      </View>
    );
  }

  // ---- G: the email belongs to a Google account -------------------------------
  function renderGoogle() {
    return (
      <View>
        <AuthTopBar kind="back" onPress={back} disabled={busy !== null} />
        <StepHero
          title="Esta cuenta entra con Google"
          subtitle="Este correo se registró con Google, así que no tiene contraseña."
        />
        <View style={{ gap: 16, marginTop: 32 }}>
          {banner}
          <EmailCard
            email={email.trim()}
            actionLabel="Cambiar"
            actionAccessibilityLabel="Cambiar correo"
            disabled={busy !== null}
            onAction={() => goTo("email", { focusEmail: true })}
          />
          {google}
          <View style={{ gap: 4 }}>
            <AuthCaption>
              ¿Prefieres usar contraseña? Te enviaremos un enlace por correo para crearla.
            </AuthCaption>
            <AuthLink
              label="Crear una contraseña"
              disabled={busy !== null}
              onPress={() => forgotPassword(email)}
            />
          </View>
        </View>
      </View>
    );
  }

  const content =
    step === "doors"
      ? renderDoors()
      : step === "email"
        ? renderEmail()
        : step === "create"
          ? renderCreate()
          : renderGoogle();

  return (
    <AuthLayout>
      {transition.kind === "page" ? (
        <Animated.View style={[{ flexGrow: 1 }, pageEnter]}>{content}</Animated.View>
      ) : (
        <View style={{ flexGrow: 1 }}>{content}</View>
      )}
    </AuthLayout>
  );
}
