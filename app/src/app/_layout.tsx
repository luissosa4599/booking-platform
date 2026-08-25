import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { queryClient } from "@/lib/api/queryClient";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";

import "@/global.css";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <Stack screenOptions={{ headerShown: false }} />
        </GestureHandlerRootView>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
