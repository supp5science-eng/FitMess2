import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { Background } from "../components/Background";
import { WeeklyBars, WeightTrend } from "../components/WeightTrend";
import { Kicker, KineticText } from "../components/KineticText";
import { useFadeInOut, useRise } from "../animate";
import { fontFamily } from "../fonts";
import { theme } from "../theme";

const Card: React.FC<{
  title: string;
  sub: string;
  delay: number;
  children: React.ReactNode;
}> = ({ title, sub, delay, children }) => {
  const rise = useRise(delay, 46);
  return (
    <div
      style={{
        background: theme.color.card,
        border: `1px solid ${theme.color.border}`,
        borderRadius: theme.radius.lg,
        padding: "26px 30px",
        boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
        fontFamily,
        transform: `translateY(${rise.y}px)`,
        opacity: rise.opacity,
      }}
    >
      <div style={{ color: theme.color.fg, fontSize: 24, fontWeight: 800 }}>{title}</div>
      <div style={{ color: theme.color.muted, fontSize: 16, marginBottom: 18 }}>{sub}</div>
      {children}
    </div>
  );
};

/** Feature 2 — /analitika. Weekly budget bars + the smoothed weight trend. */
export const FeatureAnalitika: React.FC = () => {
  const fade = useFadeInOut();
  const { width } = useVideoConfig();
  const vertical = width < 1300;

  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <Background variant="brand">
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
            flexDirection: "column",
            gap: 44,
            padding: "0 6%",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <Kicker text="Analitika" delay={2} />
            <KineticText
              text="Nedelja koja *ide* ka cilju."
              delay={8}
              size={vertical ? 58 : 74}
            />
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: vertical ? "column" : "row",
              gap: 34,
              alignItems: "stretch",
            }}
          >
            <Card title="Nedeljni budžet" sub="kalorije po danu vs. cilj" delay={22}>
              <WeeklyBars width={vertical ? 560 : 560} height={260} delay={30} />
            </Card>
            <Card title="Trend težine" sub="7-dnevni prosek, ka cilju" delay={30}>
              <WeightTrend width={vertical ? 560 : 560} height={260} delay={40} />
            </Card>
          </div>
        </AbsoluteFill>
      </Background>
    </AbsoluteFill>
  );
};
