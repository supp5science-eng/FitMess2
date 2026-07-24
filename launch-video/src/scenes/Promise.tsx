import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { Background } from "../components/Background";
import { KineticText, Kicker } from "../components/KineticText";
import { useFadeInOut } from "../animate";
import { fontFamily } from "../fonts";
import { theme } from "../theme";

/** The reframe: calm signal, a plan you can keep, the week as the unit. */
export const Promise: React.FC = () => {
  const frame = useCurrentFrame();
  const fade = useFadeInOut();

  const sub = interpolate(frame, [58, 78], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <Background variant="brand">
        <AbsoluteFill
          style={{ justifyContent: "center", alignItems: "center", gap: 30, padding: "0 8%" }}
        >
          <Kicker text="FitMess umesto toga" delay={2} />
          <KineticText
            text="Miran signal. *Plan* koji možeš da održiš."
            delay={10}
            size={82}
            maxWidth={1200}
          />
          <div
            style={{
              opacity: sub,
              transform: `translateY(${(1 - sub) * 12}px)`,
              display: "flex",
              gap: 20,
              marginTop: 8,
              fontFamily,
            }}
          >
            {["Bez kazne", "Bez crvenog", "Bez „omanuo si"].map((t) => (
              <div
                key={t}
                style={{
                  padding: "12px 22px",
                  borderRadius: 999,
                  border: `1.5px solid ${theme.color.brand}55`,
                  background: theme.color.card,
                  color: theme.color.brandSoft,
                  fontSize: 24,
                  fontWeight: 600,
                }}
              >
                {t}
              </div>
            ))}
          </div>
        </AbsoluteFill>
      </Background>
    </AbsoluteFill>
  );
};
