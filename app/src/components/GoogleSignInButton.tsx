import { Button } from "@/components/Button";
import { useGoogleAuth } from "@/lib/auth/google";
import { useAuthStore } from "@/lib/session";

interface Props {
  busy: boolean;
  /** Primary style when Google is the only entry, secondary when the dev link is also shown. */
  emphasis: "primary" | "secondary";
  onBusyChange: (busy: boolean) => void;
  onError: (message: string | null) => void;
}

/**
 * Isolated so `useGoogleAuth` (which throws at construction when no client id is
 * configured) is only ever called when the caller has checked
 * `isGoogleAuthConfigured()` and rendered this. On success the AuthGate in
 * _layout.tsx redirects out of /sign-in automatically.
 */
export function GoogleSignInButton({ busy, emphasis, onBusyChange, onError }: Props) {
  const google = useGoogleAuth();
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);

  async function press() {
    onError(null);
    const idToken = await google.signIn();
    if (!idToken) {
      return; // cancelled / dismissed
    }
    onBusyChange(true);
    try {
      await signInWithGoogle(idToken);
    } catch {
      onError("No pudimos entrar con Google. Intenta de nuevo.");
      onBusyChange(false);
    }
  }

  return (
    <Button
      variant={emphasis === "primary" ? "filled" : "gray"}
      disabled={busy || !google.ready}
      loading={busy}
      onPress={press}
    >
      Continuar con Google
    </Button>
  );
}
