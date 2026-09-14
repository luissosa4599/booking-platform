export interface GoogleAuth {
  /** The auth request is built — safe to call `signIn`. */
  ready: boolean;
  /** Opens Google's consent flow. Resolves the ID token, or null if cancelled/dismissed/failed. */
  signIn: () => Promise<string | null>;
}
