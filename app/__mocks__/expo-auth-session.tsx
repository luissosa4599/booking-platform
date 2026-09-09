// Jest stub — the real module reaches into the Expo manifest / linking at
// render time (makeRedirectUri -> createURL), which isn't wired in the test
// env. None of the auth flows are exercised in unit tests.

export enum ResponseType {
  Code = "code",
  Token = "token",
  IdToken = "id_token",
}

export type DiscoveryDocument = Record<string, string>;

export function makeRedirectUri(): string {
  return "http://localhost:8081";
}

export function useAuthRequest() {
  return [null, null, async () => ({ type: "cancel" as const })];
}

export function useAutoDiscovery() {
  return null;
}
