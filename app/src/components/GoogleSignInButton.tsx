import { AuthButton } from "@/components/auth/AuthButton";
import { GoogleG } from "@/components/auth/GoogleG";
import { useGoogleAuth } from "@/lib/auth/google";
import { useAuthStore } from "@/lib/session";

interface Props {
  /** This button's own request is in flight (D2) — spinner + "Conectando…". */
  loading: boolean;
  /** Something else is in flight, or there's no network. */
  disabled: boolean;
  onLoadingChange: (loading: boolean) => void;
  /** The token exchange with our API failed (not a cancelled picker). */
  onError: () => void;
}

/**
 * Isolated so `useGoogleAuth` (which throws at construction when no client id is
 * configured) is only ever called when the caller has checked
 * `isGoogleAuthConfigured()` and rendered this. On success the AuthGate in
 * _layout.tsx moves the fresh session off the auth screens.
 *
 * Google is also how a brand-new Google user signs up — Google already gives
 * us a verified email and a name, so there's no "create your account" step.
 */
export function GoogleSignInButton({ loading, disabled, onLoadingChange, onError }: Props) {
  const google = useGoogleAuth();
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);

  async function press() {
    onLoadingChange(true);
    const idToken = await google.signIn();
    if (!idToken) {
      // Cancelled picker (or a native picker error, logged in dev): back to
      // where they were, no message (handoff D2).
      onLoadingChange(false);
      return;
    }
    try {
      await signInWithGoogle(idToken);
    } catch {
      onLoadingChange(false);
      onError();
    }
  }

  return (
    <AuthButton
      variant="secondary"
      label="Continuar con Google"
      loadingLabel="Conectando con Google…"
      loading={loading}
      disabled={disabled || !google.ready}
      icon={<GoogleG size={20} />}
      onPress={press}
    />
  );
}
