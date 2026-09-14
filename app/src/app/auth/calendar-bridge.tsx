import { useEffect } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { Screen } from "@/components/Screen";

/**
 * Web-only bridge for the native Google Calendar OAuth flow
 * (lib/auth/googleCalendar.ts). Google's "Web" OAuth client type rejects a
 * bare custom-scheme redirect_uri (confirmed in Google Cloud Console:
 * "Debe contener el nombre de un dominio") — so on native we send Google
 * here (a real https URL, valid for a Web client) instead of straight to
 * `app://`. This page's only job is the second hop: forward every query
 * param (code/state/error) on to the app's own scheme, which is what
 * `expo-auth-session`'s native listener actually watches for — an https
 * redirect alone can't "pass the information back into the app" (Expo's own
 * docs), only the registered scheme can.
 *
 * A user only ever lands here inside the ephemeral in-app browser
 * (ASWebAuthenticationSession / Custom Tabs) that `promptAsync()` opened —
 * never as a real destination to browse to.
 */
export default function CalendarBridgeScreen() {
  const params = useLocalSearchParams<Record<string, string>>();

  useEffect(() => {
    // Same tab/context the OS auth session is watching — a new tab/window
    // (what expo-linking's openURL can do) wouldn't be, so this navigates
    // directly rather than going through Linking.
    const query = new URLSearchParams(params as Record<string, string>).toString();
    window.location.replace(`app://${query ? `?${query}` : ""}`);
  }, [params]);

  return (
    <Screen bg="card">
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-body text-label-3">Regresando a Tempo…</Text>
      </View>
    </Screen>
  );
}
