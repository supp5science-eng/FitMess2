import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { Background } from "../components/Background";
import { PhoneFrame } from "../components/PhoneFrame";
import { CalorieRing } from "../components/CalorieRing";
import { MacroBars } from "../components/MacroBars";
import { Kicker, KineticText } from "../components/KineticText";
import { useFadeInOut, useRise } from "../animate";
import { fontFamily } from "../fonts";
import { theme } from "../theme";

/**
 * Feature 1 — /danas. The calorie ring + macro bars, live inside the phone,
 * next to a headline. This is "Today at a glance".
 */
export const FeatureDanas: React.FC = () => {
  const fade = useFadeInOut();
  const { width } = useVideoConfig();
  const vertical = width < 1300;
  const rise = useRise(6, 50);

  const phone = (
    <div style={{ transform: `translateY(${rise.y}px)`, opacity: rise.opacity }}>
      <PhoneFrame width={vertical ? 420 : 400} activeTab={0}>
        <div
          style={{
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 26,
            fontFamily,
          }}
        >
          <div style={{ alignSelf: "flex-start" }}>
            <div style={{ color: theme.color.fg, fontSize: 26, fontWeight: 800 }}>Danas</div>
            <div style={{ color: theme.color.muted, fontSize: 15 }}>četvrtak, 24. jul</div>
          </div>
          <CalorieRing size={240} progress={0.62} budget={2100} delay={14} />
          <MacroBars width={300} delay={30} />
        </div>
      </PhoneFrame>
    </div>
  );

  const copy = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 22,
        maxWidth: vertical ? 720 : 620,
        alignItems: vertical ? "center" : "flex-start",
        textAlign: vertical ? "center" : "left",
      }}
    >
      <Kicker text="Danas" delay={4} />
      <KineticText
        text="Ceo dan u *jednom* pogledu."
        delay={10}
        size={vertical ? 60 : 76}
        align={vertical ? "center" : "left"}
      />
      <div style={{ fontFamily, fontSize: 26, color: theme.color.muted, fontWeight: 500, lineHeight: 1.4 }}>
        Prsten kalorija, makro trake i preostali budžet — bez računanja, bez stresa.
      </div>
    </div>
  );

  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <Background variant="brand">
        <AbsoluteFill
          style={{
            flexDirection: vertical ? "column" : "row",
            justifyContent: "center",
            alignItems: "center",
            gap: vertical ? 40 : 90,
            padding: "0 7%",
          }}
        >
          {vertical ? (
            <>
              {copy}
              {phone}
            </>
          ) : (
            <>
              {phone}
              {copy}
            </>
          )}
        </AbsoluteFill>
      </Background>
    </AbsoluteFill>
  );
};
