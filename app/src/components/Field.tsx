import type { ReactNode } from "react";
import { Text, View } from "react-native";

/** A labelled form section: an uppercase caption above its control(s). */
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <View className="gap-2">
      <Text className="pl-1 text-footnote font-semibold uppercase text-label-4">
        {label}
      </Text>
      {children}
    </View>
  );
}
