import * as Crypto from "expo-crypto";
import { Platform } from "react-native";

/**
 * A v4 UUID that also works when the web app is served from an insecure origin
 * (a plain-http LAN IP, e.g. when testing on a phone). `crypto.randomUUID()`
 * is secure-context-only; `crypto.getRandomValues()` is not, so we build the
 * UUID from that when `randomUUID` is missing.
 */
export function uuid(): string {
  if (Platform.OS !== "web") {
    return Crypto.randomUUID();
  }

  const webCrypto = globalThis.crypto;
  if (webCrypto?.randomUUID) {
    return webCrypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  webCrypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0"));
  return (
    hex.slice(0, 4).join("") +
    "-" +
    hex.slice(4, 6).join("") +
    "-" +
    hex.slice(6, 8).join("") +
    "-" +
    hex.slice(8, 10).join("") +
    "-" +
    hex.slice(10, 16).join("")
  );
}
