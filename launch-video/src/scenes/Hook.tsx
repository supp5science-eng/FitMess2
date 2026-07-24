import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { Background } from "../components/Background";
import { KineticText, Kicker } from "../components/KineticText";
import { useFadeInOut } from "../animate";
import { fontFamily } from "../fonts";
import { theme } from "../theme";

/**
 * Cold open. A zero-shame hook — the emotional promise of the product before
 * we ever say its name. Big kinetic type over a breathing teal void.
 */
export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = useFadeInOut();

  // A single word "loš" flashes then gets crossed out — but calmly.
  const strike = spring({ frame: frame - 46, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <Background variant="brand">
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
            padding: "0 8%",
            gap: 34,
          }}
        >
          <Kicker text="FitMess" delay={4} />
          <div style={{ position: "relative" }}>
            <KineticText
              text="Jedan *loš* dan"
              delay={10}
              size={96}
              align="center"
              highlight={theme.color.muted}
            />
            {/* calm strike-through over "loš" — no punitive red */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "42%",
                width: `${strike * 15}%`,
                height: 6,
                borderRadius: 999,
                background: theme.color.brand,
                boxShadow: `0 0 16px ${theme.color.brand}`,
              }}
            />
          </div>
          <KineticText text="nije kraj sveta." delay={30} size={96} align="center" />

          <div
            style={{
              opacity: interpolate(frame, [70, 88], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              fontFamily,
              fontSize: 30,
              fontWeight: 500,
              color: theme.color.muted,
              marginTop: 10,
            }}
          >
            Praćenje kalorija — bez griže savesti.
          </div>
        </AbsoluteFill>
      </Background>
    </AbsoluteFill>
  );
};
