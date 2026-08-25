import { Children, Fragment, type ReactNode } from "react";
import { Text, View } from "react-native";

import { cn } from "@/lib/cn";

interface GroupProps {
  /** bg-card (default) sits on a canvas screen; bg-canvas stands out on a white screen. */
  variant?: "card" | "canvas";
  header?: string;
  footer?: string;
  children: ReactNode;
}

export function Group({ variant = "card", header, footer, children }: GroupProps) {
  const items = Children.toArray(children);

  return (
    <View className="gap-2">
      {header ? (
        <Text className="pl-1 text-footnote font-semibold uppercase text-label-4">
          {header}
        </Text>
      ) : null}

      <View
        className={cn(
          "overflow-hidden rounded-group",
          variant === "canvas" ? "bg-canvas" : "bg-card",
        )}
      >
        {items.map((child, index) => (
          <Fragment key={index}>
            {child}
            {index < items.length - 1 ? (
              <View className="ml-4 h-px bg-hairline" />
            ) : null}
          </Fragment>
        ))}
      </View>

      {footer ? (
        <Text className="pl-1 text-footnote text-label-4">{footer}</Text>
      ) : null}
    </View>
  );
}
