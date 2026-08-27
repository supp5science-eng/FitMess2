import { Text as RNText, type TextProps as RNTextProps, StyleSheet } from "react-native";

import { colors } from "@/theme/tokens";

/**
 * The app's only text primitive.
 *
 * Two behaviours it exists to guarantee, both of which the WebView got wrong:
 *
 * 1. TEXT IS NOT SELECTABLE. In a web view every label, every number, every
 *    heading is selectable, so a long press anywhere raises the copy/lookup
 *    bubble over the UI — one of the loudest tells that an "app" is a page.
 *    RN's default is already non-selectable; this component makes that a rule
 *    rather than a default, so the only selectable text in FitMess is text a
 *    call site deliberately asks for (`selectable`) — a Jarvis reply the user
 *    may genuinely want to copy, and nothing else.
 *
 * 2. TYPE SCALING IS BOUNDED. The system font-size slider must be honoured —
 *    refusing it is an accessibility failure and Apple checks for it — but
 *    FitMess is full of dense numeric rows (macros, the day strip) that break
 *    apart past a point. Every variant below therefore scales, up to a cap.
 */

type Variant =
  /** Screen titles. */
  | "title"
  /** Section headings inside a screen. */
  | "heading"
  /** Default running text. */
  | "body"
  /** Supporting text: units, hints, timestamps. */
  | "caption"
  /** A figure meant to be read at arm's length — the calorie ring's number. */
  | "figure"
  /** Buttons and tab labels. */
  | "label";

export type TextProps = RNTextProps & {
  variant?: Variant;
  /** Override the ink. Defaults per variant — supporting text is the muted
   *  ink, everything else is the full ink. */
  color?: string;
};

export function Text({ variant = "body", color, style, ...rest }: TextProps) {
  return (
    <RNText
      // Honour the system slider, but not past the point where the numeric
      // rows stop fitting. Figures get less headroom than prose because they
      // sit in fixed-width columns.
      allowFontScaling
      maxFontSizeMultiplier={variant === "figure" ? 1.3 : 1.6}
      {...rest}
      style={[styles[variant], color ? { color } : null, style]}
    />
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
    letterSpacing: -0.4,
    color: colors.ink,
  },
  heading: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: colors.ink,
  },
  body: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "400",
    color: colors.ink,
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "400",
    color: colors.mutedForeground,
  },
  figure: {
    fontSize: 44,
    lineHeight: 48,
    fontWeight: "700",
    // Tabular figures: without this the ring's number jitters sideways as the
    // digits change, because proportional "1" is narrower than "8".
    fontVariant: ["tabular-nums"],
    letterSpacing: -1,
    color: colors.ink,
  },
  label: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
    letterSpacing: -0.1,
    color: colors.ink,
  },
});
