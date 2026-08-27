import { useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type ViewStyle,
} from "react-native";

import { feedback } from "@/lib/feedback";
import { colors, lift, radius, spacing } from "@/theme/tokens";
import { Text } from "./Text";

/**
 * The app's button, and the answer to "why doesn't it feel like an app".
 *
 * Three things happen on a press, and the ORDER is the whole point:
 *
 *   1. The haptic fires on press-IN, not on press-out and not on the eventual
 *      `onPress`. A phone that buzzes when the finger LANDS feels like it
 *      responded; the identical buzz 120ms later, after the touch is released
 *      and the handler has run, feels like a notification about something that
 *      already happened. This single line is most of the difference.
 *   2. The button scales down in the same frame, on the native driver, so the
 *      visual and the haptic are one event rather than two.
 *   3. `onPress` runs last and may be slow (a network call). Nothing about the
 *      feel of the press is allowed to wait on it.
 *
 * `disabled` and `loading` suppress the haptic: buzzing for a press that does
 * nothing teaches the user that the buzz means nothing.
 */

type Variant =
  /** The single loudest thing on a screen — bright ink, white type. */
  | "primary"
  /** A second action beside a primary one. */
  | "secondary"
  /** A tertiary action: no fill, no hairline, just ink. */
  | "ghost"
  /** Deletes and disconnects. Brick, never a screen red. */
  | "destructive";

export type ButtonProps = Omit<PressableProps, "style" | "children"> & {
  title: string;
  variant?: Variant;
  loading?: boolean;
  /** Fills the width of its parent. Used for the primary action of a sheet. */
  block?: boolean;
  style?: ViewStyle;
};

export function Button({
  title,
  variant = "primary",
  loading = false,
  block = false,
  disabled,
  onPressIn,
  style,
  ...rest
}: ButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const inert = disabled || loading;

  const animate = (to: number) =>
    Animated.spring(scale, {
      toValue: to,
      // Stiff and barely bouncy: a printed button is pressed, not wobbled.
      speed: 40,
      bounciness: 0,
      useNativeDriver: true,
    }).start();

  return (
    <Animated.View style={[{ transform: [{ scale }] }, block ? styles.block : null]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !!inert, busy: loading }}
        disabled={inert}
        onPressIn={(event) => {
          if (!inert) feedback.tap();
          animate(0.97);
          onPressIn?.(event);
        }}
        onPressOut={() => animate(1)}
        style={[
          styles.base,
          styles[variant],
          block ? styles.block : null,
          inert ? styles.inert : null,
          style,
        ]}
        {...rest}
      >
        {/* The label stays mounted while loading and is hidden behind the
            spinner rather than swapped out, so the button cannot change width
            mid-press and shift the layout under the finger. */}
        <Text variant="label" color={labelColor[variant]} style={loading ? styles.hidden : null}>
          {title}
        </Text>
        {loading ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <ActivityIndicator color={labelColor[variant]} style={styles.spinner} />
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const labelColor: Record<Variant, string> = {
  primary: colors.primaryForeground,
  secondary: colors.ink,
  ghost: colors.inkBright,
  destructive: colors.primaryForeground,
};

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  block: { alignSelf: "stretch" },
  primary: { backgroundColor: colors.primary, ...lift },
  secondary: {
    backgroundColor: colors.secondary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  ghost: { backgroundColor: "transparent" },
  destructive: { backgroundColor: colors.destructive, ...lift },
  // Dimmed, not greyed: grey is not on this plate.
  inert: { opacity: 0.45 },
  hidden: { opacity: 0 },
  spinner: { flex: 1 },
});
