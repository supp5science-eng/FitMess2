import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { Background } from "../components/Background";
import { Logo } from "../components/Logo";
import { useFadeInOut } from "../animate";
import { fontFamily } from "../fonts";
import { theme } from "../theme";

/** The brand moment — the mark draws itself on, wordmark lands, tagline settles. */
export const LogoReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = useFadeInOut();

  const pulse = spring({ frame: frame - 4, fps, config: { damping: 14, stiffness: 90 } });
  const tagline = interpolate(frame, [52, 70], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <Background variant="brand" grid>
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
            flexDirection: "column",
            gap: 30,
          }}
        >
          <div style={{ transform: `scale(${interpolate(pulse, [0, 1], [0.86, 1])})` }}>
            <Logo size={200} layout="stack" delay={6} />
          </div>
          <div
            style={{
              fontFamily,
              fontSize: 28,
              fontWeight: 500,
              color: theme.color.muted,
              letterSpacing: 0.5,
              opacity: tagline,
              transform: `translateY(${(1 - tagline) * 12}px)`,
              textAlign: "center",
            }}
          >
            Nedelja je jedinica uspeha.{" "}
            <span style={{ color: theme.color.brand, fontWeight: 700 }}>Ne pojedini dan.</span>
          </div>
        </AbsoluteFill>
      </Background>
    </AbsoluteFill>
  );
};
