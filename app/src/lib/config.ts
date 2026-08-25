import { Platform } from "react-native";

function resolveApiUrl(): string {
  if (!__DEV__) {
    const productionUrl = process.env.EXPO_PUBLIC_API_URL;
    if (!productionUrl) {
      throw new Error(
        "EXPO_PUBLIC_API_URL must be set for production builds — none was provided.",
      );
    }
    return productionUrl;
  }

  if (Platform.OS === "android") {
    // Android emulator maps the host machine's loopback to 10.0.2.2.
    return "http://10.0.2.2:5000";
  }

  return "http://localhost:5000";
}

export const API_URL = resolveApiUrl();
