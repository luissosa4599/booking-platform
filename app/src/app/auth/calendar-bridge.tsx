import { useEffect, useMemo } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { Button } from "@/components/Button";
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
  const target = useMemo(() => {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return `app://${query ? `?${query}` : ""}`;
  }, [params]);

  useEffect(() => {
    // Same tab/context the OS auth session is watching — a new tab/window
    // (what expo-linking's openURL can do) wouldn't be, so this navigates
    // directly rather than going through Linking.
    window.location.replace(target);
  }, [target]);

  // Chrome can refuse a script-started jump to a custom scheme when no tap
  // led to it; a real tap on this button always counts as one.
  return (
    <Screen bg="card">
      <View className="flex-1 items-center justify-center gap-4 px-6">
        <Text className="text-body text-label-3">Regresando a Tempo…</Text>
        <Button onPress={() => window.location.assign(target)}>Regresar a Tempo</Button>
      </View>
    </Screen>
  );
}
