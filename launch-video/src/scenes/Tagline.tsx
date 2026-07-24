import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { Background } from "../components/Background";
import { KineticText } from "../components/KineticText";
import { useFadeInOut } from "../animate";
import { fontFamily } from "../fonts";
import { theme } from "../theme";

/** The line the whole product is built around, alone on screen. */
export const Tagline: React.FC = () => {
  const frame = useCurrentFrame();
  const fade = useFadeInOut();
  const line = interpolate(frame, [40, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <Background variant="brand" grid={false}>
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 8%", gap: 28 }}>
          <KineticText
            text="Praćenje kalorija bez *griže savesti*."
            delay={6}
            size={90}
            stagger={4}
            maxWidth={1300}
          />
          <div
            style={{
              width: interpolate(line, [0, 1], [0, 220]),
              height: 4,
              borderRadius: 999,
              background: theme.color.brand,
              boxShadow: `0 0 20px ${theme.color.brand}`,
            }}
          />
          <div
            style={{
              opacity: line,
              fontFamily,
              fontSize: 27,
              fontWeight: 500,
              color: theme.color.muted,
            }}
          >
            Nedelja je jedinica uspeha. Ne pojedini dan.
          </div>
        </AbsoluteFill>
      </Background>
    </AbsoluteFill>
  );
};
