import React from "react";
import { useCurrentFrame, spring, useVideoConfig, interpolate } from "remotion";
import { fontFamily } from "../fonts";
import { theme } from "../theme";

/**
 * Word-by-word kinetic reveal. Each word springs up + fades in, staggered.
 * The workhorse of the explainer look — use it for every headline.
 */
export const KineticText: React.FC<{
  text: string;
  /** frame the animation starts on (relative to the Sequence). */
  delay?: number;
  /** frames between each word. */
  stagger?: number;
  size?: number;
  weight?: number;
  color?: string;
  lineHeight?: number;
  letterSpacing?: number;
  align?: "left" | "center" | "right";
  maxWidth?: number;
  /** words wrapped in *asterisks* get the highlight color. */
  highlight?: string;
  style?: React.CSSProperties;
}> = ({
  text,
  delay = 0,
  stagger = 3,
  size = 72,
  weight = 800,
  color = theme.color.fg,
  lineHeight = 1.08,
  letterSpacing = -1.5,
  align = "center",
  maxWidth,
  highlight = theme.color.brand,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Parse `*...*` highlight spans. A span may cover several words and may end
  // on trailing punctuation (e.g. "*guši*." or "*griže savesti*."). We walk the
  // words toggling an "inside highlight" flag on every asterisk and strip them.
  let on = false;
  const words = text.split(" ").map((raw) => {
    const highlighted = on || raw.includes("*");
    for (const ch of raw) if (ch === "*") on = !on;
    return { text: raw.replace(/\*/g, ""), highlighted };
  });

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: `0 ${size * 0.26}px`,
        justifyContent:
          align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start",
        maxWidth,
        fontFamily,
        fontSize: size,
        fontWeight: weight,
        color,
        lineHeight,
        letterSpacing,
        textAlign: align,
        ...style,
      }}
    >
      {words.map((word, i) => {
        const t = spring({
          frame: frame - delay - i * stagger,
          fps,
          config: { damping: 200, stiffness: 120, mass: 0.7 },
        });
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: t,
              transform: `translateY(${(1 - t) * 0.55 * size}px)`,
              color: word.highlighted ? highlight : undefined,
            }}
          >
            {word.text}
          </span>
        );
      })}
    </div>
  );
};

/**
 * A single line that wipes in behind a moving mask — good for kickers /
 * eyebrow labels above a headline.
 */
export const Kicker: React.FC<{
  text: string;
  delay?: number;
  color?: string;
}> = ({ text, delay = 0, color = theme.color.brand }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = spring({ frame: frame - delay, fps, config: { damping: 200 } });
  const clip = interpolate(t, [0, 1], [100, 0]);
  return (
    <div
      style={{
        fontFamily,
        fontSize: 24,
        fontWeight: 700,
        letterSpacing: 6,
        textTransform: "uppercase",
        color,
        display: "flex",
        alignItems: "center",
        gap: 14,
        clipPath: `inset(0 ${clip}% 0 0)`,
      }}
    >
      <span style={{ width: 34, height: 2, background: color, display: "inline-block" }} />
      {text}
    </div>
  );
};
