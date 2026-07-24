import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { Background } from "../components/Background";
import { Logo } from "../components/Logo";
import { useFadeInOut } from "../animate";
import { fontFamily } from "../fonts";
import { theme } from "../theme";

/** CTA close — logo, URL, phone-only note, a QR-ish glyph. */
export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = useFadeInOut(12, 20);

  const url = spring({ frame: frame - 40, fps, config: { damping: 200 } });
  const note = interpolate(frame, [56, 72], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <Background variant="brand">
        <AbsoluteFill
          style={{ justifyContent: "center", alignItems: "center", flexDirection: "column", gap: 40 }}
        >
          <Logo size={180} layout="stack" delay={6} />

          <div
            style={{
              opacity: url,
              transform: `scale(${interpolate(url, [0, 1], [0.92, 1])})`,
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "18px 34px",
              borderRadius: 999,
              background: theme.color.brand,
              color: theme.color.brandDeep,
              fontFamily,
              fontSize: 40,
              fontWeight: 800,
              letterSpacing: -0.5,
              boxShadow: `0 20px 60px ${theme.color.brand}55`,
            }}
          >
            fitmess.app
          </div>

          <div
            style={{
              opacity: note,
              transform: `translateY(${(1 - note) * 10}px)`,
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontFamily,
              fontSize: 24,
              fontWeight: 500,
              color: theme.color.muted,
            }}
          >
            <span style={{ fontSize: 22 }}>📱</span> Otvori na telefonu — instaliraj kao aplikaciju.
          </div>
        </AbsoluteFill>
      </Background>
    </AbsoluteFill>
  );
};
