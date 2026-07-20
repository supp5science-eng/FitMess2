import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { theme } from "../theme";

/**
 * Tech-y animated backdrop: a slowly drifting perspective grid + a breathing
 * teal glow. Deliberately low-contrast so foreground type/UI stays legible.
 */
export const GridBackground: React.FC<{ intensity?: number }> = ({ intensity = 1 }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  const drift = (frame * 0.35) % 80; // grid scroll
  const glow = interpolate(
    Math.sin((frame / durationInFrames) * Math.PI * 2),
    [-1, 1],
    [0.35, 0.7],
  ) * intensity;

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg }}>
      {/* radial teal glow */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(120% 80% at 50% 12%, ${theme.brand}${Math.round(
            glow * 40,
          )
            .toString(16)
            .padStart(2, "0")} 0%, transparent 55%)`,
        }}
      />
      {/* grid */}
      <svg width={width} height={height} style={{ position: "absolute", opacity: 0.18 * intensity }}>
        <defs>
          <linearGradient id="gridFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={theme.brand} stopOpacity="0.9" />
            <stop offset="70%" stopColor={theme.brand} stopOpacity="0.1" />
            <stop offset="100%" stopColor={theme.brand} stopOpacity="0" />
          </linearGradient>
        </defs>
        {Array.from({ length: Math.ceil(width / 80) + 2 }).map((_, i) => (
          <line
            key={`v${i}`}
            x1={i * 80 - drift}
            y1={0}
            x2={i * 80 - drift}
            y2={height}
            stroke="url(#gridFade)"
            strokeWidth={1}
          />
        ))}
        {Array.from({ length: Math.ceil(height / 80) + 2 }).map((_, i) => (
          <line
            key={`h${i}`}
            x1={0}
            y1={i * 80 - drift}
            x2={width}
            y2={i * 80 - drift}
            stroke="url(#gridFade)"
            strokeWidth={1}
          />
        ))}
      </svg>
      {/* vignette to keep edges dark */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(80% 60% at 50% 50%, transparent 40%, ${theme.bg} 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};
