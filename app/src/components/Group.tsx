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

// Handoff § "Cross-platform" also calls for groups splitting into two
// columns (`flexWrap` + `basis-1/2`) on web at ≥1024px. Tried it — computed
// styles showed flex-wrap/basis-1/2 correctly resolved (getComputedStyle
// confirmed flexWrap:"wrap", flexBasis:"50%"), but real rendering still came
// out single-column with content overflowing its 50%-width box, and the
// mismatch didn't resolve with a clean cache / fresh server. Reverted rather
// than ship an unverified layout — see docs/session-log.md for the repro.
// Left as a known gap, not implemented.
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
