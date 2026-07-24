import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { theme } from "../theme";

type Props = {
  /** Base tint. "brand" pulls a subtle teal glow, "neutral" stays near-black. */
  variant?: "brand" | "neutral" | "warm";
  /** Show the faint dot grid. */
  grid?: boolean;
  /** Show slow-drifting glow orbs. */
  orbs?: boolean;
  children?: React.ReactNode;
};

/**
 * The shared canvas behind every scene: a deep near-black base, an optional
 * dot grid, slow drifting glow orbs, a vignette and a film-grain overlay.
 * Together they give the flat scenes the layered, "premium explainer" depth.
 */
export const Background: React.FC<Props> = ({
  variant = "brand",
  grid = true,
  orbs = true,
  children,
}) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  const glow =
    variant === "warm"
      ? theme.color.gold
      : variant === "neutral"
        ? theme.color.brandDeep
        : theme.color.brand;

  // Very slow breathing so the background never feels static.
  const breathe = interpolate(
    Math.sin((frame / durationInFrames) * Math.PI * 2),
    [-1, 1],
    [0.85, 1.05],
  );

  const drift = (seed: number, amp: number) =>
    Math.sin(frame / (60 + seed * 17) + seed) * amp;

  return (
    <AbsoluteFill style={{ backgroundColor: theme.color.bg, overflow: "hidden" }}>
      {/* base radial wash */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(120% 90% at 50% -10%, ${glow}22 0%, ${theme.color.bg} 55%)`,
          opacity: breathe,
        }}
      />

      {orbs && (
        <>
          <Orb
            x={width * 0.2 + drift(1, 60)}
            y={height * 0.28 + drift(2, 40)}
            r={Math.min(width, height) * 0.42}
            color={glow}
            opacity={0.16}
          />
          <Orb
            x={width * 0.82 + drift(3, 50)}
            y={height * 0.78 + drift(4, 55)}
            r={Math.min(width, height) * 0.5}
            color={variant === "warm" ? theme.color.gold : theme.color.brandSoft}
            opacity={0.1}
          />
        </>
      )}

      {grid && <DotGrid width={width} height={height} />}

      {children}

      {/* vignette */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(130% 100% at 50% 45%, transparent 55%, ${theme.color.bg}dd 100%)`,
          pointerEvents: "none",
        }}
      />
      <Grain />
    </AbsoluteFill>
  );
};

const Orb: React.FC<{
  x: number;
  y: number;
  r: number;
  color: string;
  opacity: number;
}> = ({ x, y, r, color, opacity }) => (
  <div
    style={{
      position: "absolute",
      left: x - r,
      top: y - r,
      width: r * 2,
      height: r * 2,
      borderRadius: "50%",
      background: `radial-gradient(circle, ${color} 0%, transparent 68%)`,
      opacity,
      filter: "blur(8px)",
    }}
  />
);

const DotGrid: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  const gap = 46;
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `radial-gradient(${theme.color.border} 1.2px, transparent 1.2px)`,
        backgroundSize: `${gap}px ${gap}px`,
        opacity: 0.5,
        maskImage: `radial-gradient(120% 90% at 50% 40%, black 30%, transparent 75%)`,
        WebkitMaskImage: `radial-gradient(120% 90% at 50% 40%, black 30%, transparent 75%)`,
        width,
        height,
      }}
    />
  );
};

/** SVG feTurbulence grain — animates subtly via the seed. */
const Grain: React.FC = () => {
  const frame = useCurrentFrame();
  const seed = Math.floor(frame / 2) % 12;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: 0.05, mixBlendMode: "overlay" }}>
      <svg width="100%" height="100%">
        <filter id={`grain-${seed}`}>
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves={2}
            seed={seed}
            stitchTiles="stitch"
          />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grain-${seed})`} />
      </svg>
    </AbsoluteFill>
  );
};
