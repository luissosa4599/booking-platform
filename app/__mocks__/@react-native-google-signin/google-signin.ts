// Manual mock for tests. The real module calls
// `TurboModuleRegistry.getEnforcing("RNGoogleSignin")` at import time, which
// throws under Jest — there's no native binary. Nothing under test drives a
// real native sign-in; this just has to import without crashing, mirroring
// the always-cancelled shape `google.native.ts` expects.
export const GoogleSignin = {
  configure: () => {},
  hasPlayServices: () => Promise.resolve(true),
  signIn: () => Promise.resolve({ type: "cancelled", data: null }),
  signInSilently: () => Promise.resolve({ type: "noSavedCredentialFound", data: null }),
  signOut: () => Promise.resolve(null),
  revokeAccess: () => Promise.resolve(null),
  hasPreviousSignIn: () => false,
  getCurrentUser: () => null,
  clearCachedAccessToken: () => Promise.resolve(null),
  getTokens: () => Promise.reject(new Error("not signed in")),
  addScopes: () => Promise.resolve(null),
};

export function isSuccessResponse() {
  return false;
}
