import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { Background } from "../components/Background";
import { Kicker, KineticText } from "../components/KineticText";
import { useFadeInOut } from "../animate";
import { fontFamily } from "../fonts";
import { theme } from "../theme";

const ITEMS = [
  { icon: "🎯", title: "Personalizovan plan", sub: "kcal + makroi iz tvojih ciljeva" },
  { icon: "⚖️", title: "Praćenje težine", sub: "gladak trend, ne dnevni šum" },
  { icon: "🌙", title: "Zero-shame ton", sub: "topli akcenat, nikad kazna" },
  { icon: "🔒", title: "Privatnost", sub: "GDPR izvoz i brisanje naloga" },
  { icon: "🇷🇸", title: "Srpski, prvi", sub: "sr-Latn, neformalno „ti" },
  { icon: "🤖", title: "FitMess Agent", sub: "razgovorni unos — uskoro" },
];

/** Rapid breadth montage — the rest of what you get, as a staggered chip grid. */
export const FeatureGrid: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const fade = useFadeInOut();
  const cols = width < 1300 ? 2 : 3;

  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <Background variant="brand">
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
            flexDirection: "column",
            gap: 48,
            padding: "0 8%",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <Kicker text="I još" delay={2} />
            <KineticText text="Sve što ti *treba* — ništa što te *guši*." delay={8} size={56} maxWidth={1200} />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gap: 22,
              maxWidth: 1150,
            }}
          >
            {ITEMS.map((it, i) => {
              const t = spring({
                frame: frame - 24 - i * 5,
                fps,
                config: { damping: 200, stiffness: 120 },
              });
              return (
                <div
                  key={it.title}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 18,
                    padding: "22px 26px",
                    borderRadius: theme.radius.md,
                    background: theme.color.card,
                    border: `1px solid ${theme.color.border}`,
                    fontFamily,
                    opacity: t,
                    transform: `translateY(${(1 - t) * 26}px)`,
                    boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 34,
                      width: 60,
                      height: 60,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 16,
                      background: theme.color.bgSoft,
                      border: `1px solid ${theme.color.border}`,
                    }}
                  >
                    {it.icon}
                  </div>
                  <div>
                    <div style={{ color: theme.color.fg, fontSize: 23, fontWeight: 700 }}>{it.title}</div>
                    <div style={{ color: theme.color.muted, fontSize: 17 }}>{it.sub}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </AbsoluteFill>
      </Background>
    </AbsoluteFill>
  );
};
