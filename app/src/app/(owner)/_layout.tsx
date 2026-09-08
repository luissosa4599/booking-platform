import { Stack } from "expo-router";

// Host route group. Its own Stack so the space-detail / form / schedule screens
// push over the host TabBar, same shape as the guest group's resource/[id].
export default function OwnerLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
