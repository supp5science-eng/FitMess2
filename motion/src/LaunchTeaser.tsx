import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { theme } from "./theme";
import { interFamily } from "./fonts";
import { GridBackground } from "./components/GridBackground";
import { Wordmark } from "./components/Wordmark";
import { CalorieRing } from "./components/CalorieRing";
import { MacroBars } from "./components/MacroBars";

const Center: React.FC<{ children: React.ReactNode; gap?: number }> = ({ children, gap = 0 }) => (
  <AbsoluteFill
    style={{
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column",
      gap,
      padding: "0 8%",
      textAlign: "center",
    }}
  >
    {children}
  </AbsoluteFill>
);

// Fade + slight rise wrapper driven by a spring, reused across scenes.
const Reveal: React.FC<{ children: React.ReactNode; delay?: number }> = ({ children, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 200 }, durationInFrames: 30 });
  return (
    <div style={{ opacity: s, transform: `translateY(${interpolate(s, [0, 1], [24, 0])}px)` }}>
      {children}
    </div>
  );
};

export const LaunchTeaser: React.FC = () => {
  const { durationInFrames, height } = useVideoConfig();
  const frame = useCurrentFrame();

  // scale the layout to the shorter/taller frame so it works in 9:16, 1:1, 16:9
  const unit = height / 1920;

  // global fade-out on the last 12 frames
  const outro = interpolate(frame, [durationInFrames - 12, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg, fontFamily: interFamily }}>
      <AbsoluteFill style={{ opacity: outro }}>
        <GridBackground />

        {/* Scene 1 — brand build (0–2.0s) */}
        <Sequence from={0} durationInFrames={70}>
          <Center gap={28 * unit}>
            <Wordmark size={150 * unit} startAt={4} />
            <Reveal delay={26}>
              <div style={{ color: theme.muted, fontSize: 34 * unit, fontWeight: 500 }}>
                praćenje kalorija · bez griže savesti
              </div>
            </Reveal>
          </Center>
        </Sequence>

        {/* Scene 2 — the ring fills (2.0–5.0s) */}
        <Sequence from={62} durationInFrames={95}>
          <Center gap={40 * unit}>
            <CalorieRing size={560 * unit} startAt={8} />
            <Reveal delay={40}>
              <div style={{ color: theme.fg, fontSize: 40 * unit, fontWeight: 600, maxWidth: 720 * unit }}>
                Vidiš tačno gde stojiš — <span style={{ color: theme.brand }}>danas</span>.
              </div>
            </Reveal>
          </Center>
        </Sequence>

        {/* Scene 3 — macros (5.0–7.4s) */}
        <Sequence from={150} durationInFrames={75}>
          <Center gap={54 * unit}>
            <Reveal delay={2}>
              <div style={{ color: theme.fg, fontSize: 46 * unit, fontWeight: 700 }}>
                Proteini, masti, ugljeni hidrati.
              </div>
            </Reveal>
            <MacroBars width={760 * unit} startAt={12} />
          </Center>
        </Sequence>

        {/* Scene 4 — the promise (7.4–9.2s) */}
        <Sequence from={222} durationInFrames={70}>
          <Center gap={18 * unit}>
            <Reveal delay={2}>
              <div
                style={{
                  color: theme.fg,
                  fontSize: 62 * unit,
                  fontWeight: 700,
                  lineHeight: 1.15,
                  maxWidth: 820 * unit,
                }}
              >
                Nedelja je jedinica uspeha.
              </div>
            </Reveal>
            <Reveal delay={16}>
              <div style={{ color: theme.muted, fontSize: 38 * unit, fontWeight: 500 }}>
                Ne jedan loš dan.
              </div>
            </Reveal>
          </Center>
        </Sequence>

        {/* Scene 5 — CTA (9.2–10s) */}
        <Sequence from={286}>
          <Center gap={20 * unit}>
            <Wordmark size={92 * unit} startAt={2} />
            <Reveal delay={12}>
              <div
                style={{
                  color: theme.brandDeep,
                  background: theme.brand,
                  fontSize: 40 * unit,
                  fontWeight: 700,
                  padding: `${18 * unit}px ${44 * unit}px`,
                  borderRadius: 999,
                  boxShadow: `0 0 ${60 * unit}px ${theme.brand}66`,
                }}
              >
                fitmess.app
              </div>
            </Reveal>
          </Center>
        </Sequence>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
