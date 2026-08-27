import { Platform } from "react-native";

function resolveApiUrl(): string {
  const explicitUrl = process.env.EXPO_PUBLIC_API_URL;

  if (!__DEV__) {
    if (!explicitUrl) {
      throw new Error(
        "EXPO_PUBLIC_API_URL must be set for production builds — none was provided.",
      );
    }
    return explicitUrl;
  }

  // In dev, an explicit URL still wins — set EXPO_PUBLIC_API_URL in app/.env to
  // e.g. http://192.168.1.42:5190 when testing on a physical phone (localhost
  // and 10.0.2.2 only reach the host from the same machine / an emulator).
  if (explicitUrl) {
    return explicitUrl;
  }

  // Port must match api/Properties/launchSettings.json's "applicationUrl".
  if (Platform.OS === "android") {
    // Android emulator maps the host machine's loopback to 10.0.2.2.
    return "http://10.0.2.2:5190";
  }

  return "http://localhost:5190";
}

export const API_URL = resolveApiUrl();
