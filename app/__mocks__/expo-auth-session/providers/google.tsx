// Jest stub for expo-auth-session/providers/google — see ../../expo-auth-session.tsx.

export function useIdTokenAuthRequest() {
  return [null, null, async () => ({ type: "cancel" as const })];
}

export function useAuthRequest() {
  return [null, null, async () => ({ type: "cancel" as const })];
}
