import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

export const haptics = {
  selection: () => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
  },
  success: () => {
    if (Platform.OS !== "web")
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },
  warning: () => {
    if (Platform.OS !== "web")
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  },
  error: () => {
    if (Platform.OS !== "web")
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  },
};
