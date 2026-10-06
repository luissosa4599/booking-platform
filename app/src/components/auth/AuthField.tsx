import { forwardRef, useState, type ReactNode } from "react";
import {
  Animated,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextStyle,
} from "react-native";

import { CircleAlert, Eye, EyeOff } from "@/lib/icons";
import { useColor } from "@/lib/theme/useColor";
import { EASE_OUT, useEnterAnimation } from "@/lib/useEnterAnimation";
import { authType, CONTROL_HEIGHT, CONTROL_RADIUS } from "./authType";

type PassThrough = Pick<
  TextInputProps,
  | "placeholder"
  | "autoComplete"
  | "textContentType"
  | "keyboardType"
  | "inputMode"
  | "autoCapitalize"
  | "returnKeyType"
  | "onSubmitEditing"
  | "submitBehavior"
  | "maxLength"
  | "autoFocus"
  | "selection"
>;

interface Props extends PassThrough {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  /** Right side of the label row — "¿La olvidaste?". */
  labelAccessory?: ReactNode;
  /** Replaces `help` below the box and paints the border state-error. */
  error?: string | null;
  /** Below the box when there's no error — a hint, a rule, a counter. */
  help?: ReactNode;
  /** While a request is in flight: fill background, not editable (D1/F4/K3). */
  readOnly?: boolean;
  /** Password field: hides the text and adds the show/hide eye. */
  secure?: boolean;
}

/**
 * The handoff §5 field: label → 8 → 52px box → 8 → error or help.
 * Focus = 2px tint border, error = 2px state-error border; padding drops to
 * 15 when the border is 2 so the text doesn't shift. Colours inline via
 * `useColor` (see AuthButton for why not classNames).
 */
export const AuthField = forwardRef<TextInput, Props>(function AuthField(
  {
    label,
    value,
    onChangeText,
    labelAccessory,
    error,
    help,
    readOnly = false,
    secure = false,
    ...inputProps
  },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const card = useColor("card");
  const fill = useColor("fill");
  const hairline = useColor("hairline");
  const tint = useColor("tint");
  const stateError = useColor("state-error");
  const label1 = useColor("label-1");
  const label3 = useColor("label-3");
  const label4 = useColor("label-4");
  const disabledLabel = useColor("disabled-label");
  // Handoff §8: an inline error fades in over 200 ms, ease-out.
  const errorStyle = useEnterAnimation(error ?? null, { duration: 200, easing: EASE_OUT });

  const thick = !!error || (focused && !readOnly);
  const borderColor = error ? stateError : focused && !readOnly ? tint : hairline;
  const hidden = secure && !revealed;

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={[authType.label, { color: label1 }]}>{label}</Text>
        {labelAccessory}
      </View>

      <View style={{ height: CONTROL_HEIGHT, justifyContent: "center" }}>
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          editable={!readOnly}
          secureTextEntry={hidden}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholderTextColor={label4}
          selectionColor={tint}
          cursorColor={tint}
          importantForAutofill="yes"
          // Emails, passwords and names: autocorrect only ever mangles them.
          autoCorrect={false}
          spellCheck={false}
          accessibilityLabel={label}
          accessibilityHint={error ?? undefined}
          {...inputProps}
          style={[
            {
              // Size only, not `authType.body`'s lineHeight — a lineHeight
              // on a single-line TextInput clips the text on Android; the
              // box height centres it instead.
              fontSize: 16,
              height: CONTROL_HEIGHT,
              borderRadius: CONTROL_RADIUS,
              borderWidth: thick ? 2 : 1,
              borderColor,
              backgroundColor: readOnly ? fill : card,
              paddingLeft: thick ? 15 : 16,
              // Room for the 48px eye (+2 gap) on password fields.
              paddingRight: secure ? 50 : thick ? 15 : 16,
              color: label1,
              // Handoff §3: the hidden-password dots get tracking 2.
              letterSpacing: hidden && value ? 2 : 0,
            },
            // Web: the focus state is the 2px border above — drop the
            // browser's own focus ring so the two don't stack. It has to be
            // `outline-style: none`: Chrome draws its `auto` ring even at
            // width 0 (measured). RN's types don't list "none".
            Platform.OS === "web" ? ({ outlineStyle: "none" } as unknown as TextStyle) : null,
          ]}
        />
        {secure ? (
          <Pressable
            onPress={() => setRevealed((v) => !v)}
            disabled={readOnly}
            accessibilityRole="button"
            accessibilityLabel={revealed ? "Ocultar contraseña" : "Mostrar contraseña"}
            accessibilityState={{ checked: revealed, disabled: readOnly }}
            // Inline position — `absolute right-*` classes have silently
            // generated no `right` rule here before (CLAUDE.md).
            style={{
              position: "absolute",
              right: 2,
              top: 2,
              width: 48,
              height: 48,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {revealed ? (
              <EyeOff size={20} color={readOnly ? disabledLabel : label3} />
            ) : (
              <Eye size={20} color={readOnly ? disabledLabel : label3} />
            )}
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <Animated.View
          style={[{ flexDirection: "row", alignItems: "flex-start", gap: 6 }, errorStyle]}
          accessibilityLiveRegion="assertive"
        >
          <View style={{ marginTop: 2 }} importantForAccessibility="no-hide-descendants">
            <CircleAlert size={16} color={stateError} />
          </View>
          <Text style={[authType.inline, { color: stateError, flex: 1 }]}>{error}</Text>
        </Animated.View>
      ) : help ? (
        help
      ) : null}
    </View>
  );
});

/** Handoff §5 "Ayuda / regla": icon 16 + help text in label-3, gap 6, with an
 * optional counter pushed to the right. */
export function FieldHelp({
  icon,
  text,
  trailing,
  accessibilityLabel,
}: {
  icon?: ReactNode;
  text: string;
  trailing?: ReactNode;
  accessibilityLabel?: string;
}) {
  const label3 = useColor("label-3");
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      {icon ? <View importantForAccessibility="no-hide-descendants">{icon}</View> : null}
      <Text
        style={[authType.help, { color: label3, flex: 1 }]}
        accessibilityLabel={accessibilityLabel}
      >
        {text}
      </Text>
      {trailing}
    </View>
  );
}
