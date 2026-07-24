import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { Background } from "../components/Background";
import { KineticText, Kicker } from "../components/KineticText";
import { useFadeInOut } from "../animate";
import { fontFamily } from "../fonts";
import { theme } from "../theme";

/**
 * The problem: other trackers punish you. We *portray* their shaming UI —
 * angry red, "FAILED", a red minus — then let it shake and glitch, so the
 * contrast with FitMess's calm lands hard.
 */
export const Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = useFadeInOut();

  const cardIn = spring({ frame: frame - 8, fps, config: { damping: 200, stiffness: 90 } });
  // nervous shake that intensifies then a shatter-fade
  const shake = frame > 40 ? Math.sin(frame * 1.4) * interpolate(frame, [40, 70], [0, 6]) : 0;
  const crack = interpolate(frame, [72, 88], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <Background variant="neutral" orbs={false}>
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: 44 }}>
          <Kicker text="Druge aplikacije" delay={2} color={theme.color.shameRed} />

          {/* the shaming card */}
          <div
            style={{
              opacity: cardIn * crack,
              transform: `translateX(${shake}px) scale(${interpolate(cardIn, [0, 1], [0.9, 1])})`,
              width: 640,
              padding: "38px 44px",
              borderRadius: theme.radius.lg,
              background: "#1a0f10",
              border: `2px solid ${theme.color.shameRed}`,
              boxShadow: `0 0 60px ${theme.color.shameRed}44`,
              fontFamily,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div
              style={{
                fontSize: 30,
                fontWeight: 800,
                color: theme.color.shameRed,
                letterSpacing: 1,
              }}
            >
              ⚠ PREKORAČIO SI CILJ
            </div>
            <div style={{ fontSize: 76, fontWeight: 900, color: theme.color.shameRed, lineHeight: 1 }}>
              +320 kcal
            </div>
            <div style={{ fontSize: 26, fontWeight: 500, color: "#e88" }}>
              Danas si omanuo. Pokušaj ponovo sutra.
            </div>
          </div>

          <KineticText
            text="Zašto da te *aplikacija* posrami?"
            delay={54}
            size={54}
            weight={700}
            highlight={theme.color.shameRed}
            maxWidth={900}
          />
        </AbsoluteFill>
      </Background>
    </AbsoluteFill>
  );
};
