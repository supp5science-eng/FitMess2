import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { Background } from "../components/Background";
import { PhoneFrame } from "../components/PhoneFrame";
import { Kicker, KineticText } from "../components/KineticText";
import { useFadeInOut, useRise } from "../animate";
import { fontFamily } from "../fonts";
import { theme } from "../theme";

const QUERY = "pileća prsa";

const RESULTS = [
  { name: "Pileća prsa, pečena", kcal: 165, sub: "na 100 g · 31g P" },
  { name: "Pileća prsa, dimljena", kcal: 110, sub: "na 100 g · 22g P" },
  { name: "Pileći file, gril", kcal: 148, sub: "na 100 g · 28g P" },
];

/** Feature 3 — /dodaj. Type, tap, logged. "Log a meal in seconds." */
export const FeatureDodaj: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const fade = useFadeInOut();
  const vertical = width < 1300;
  const rise = useRise(6, 50);

  // typing animation
  const typedCount = Math.floor(
    interpolate(frame, [16, 40], [0, QUERY.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  const typed = QUERY.slice(0, typedCount);
  const caret = Math.floor(frame / 8) % 2 === 0;

  // tap the first result at ~frame 64
  const tap = spring({ frame: frame - 64, fps, config: { damping: 12, stiffness: 200 } });
  const logged = frame > 70;
  const toast = spring({ frame: frame - 72, fps, config: { damping: 14, stiffness: 120 } });

  const phone = (
    <div style={{ transform: `translateY(${rise.y}px)`, opacity: rise.opacity }}>
      <PhoneFrame width={vertical ? 420 : 400} activeTab={2}>
        <div style={{ padding: "18px 20px", fontFamily, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ color: theme.color.fg, fontSize: 24, fontWeight: 800 }}>Dodaj obrok</div>

          {/* search field */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 18px",
              borderRadius: 16,
              background: theme.color.card,
              border: `1.5px solid ${frame > 12 && frame < 62 ? theme.color.brand : theme.color.border}`,
            }}
          >
            <div style={{ width: 18, height: 18, borderRadius: 999, border: `2.5px solid ${theme.color.muted}` }} />
            <span style={{ color: theme.color.fg, fontSize: 19, fontWeight: 500 }}>
              {typed}
              {frame < 62 && (
                <span style={{ opacity: caret ? 1 : 0, color: theme.color.brand }}>|</span>
              )}
              {typed === "" && <span style={{ color: theme.color.faint }}>Pretraži hranu…</span>}
            </span>
          </div>

          {/* results */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {RESULTS.map((r, i) => {
              const appear = spring({
                frame: frame - 42 - i * 5,
                fps,
                config: { damping: 200, stiffness: 120 },
              });
              const isTarget = i === 0;
              const flash = isTarget ? interpolate(tap, [0, 1], [0, 1]) : 0;
              return (
                <div
                  key={r.name}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "14px 16px",
                    borderRadius: 14,
                    background: isTarget && flash > 0.1 ? theme.color.cardSoft : theme.color.bgSoft,
                    border: `1px solid ${isTarget && flash > 0.1 ? theme.color.brand : theme.color.border}`,
                    opacity: appear,
                    transform: `translateX(${(1 - appear) * 20}px) scale(${isTarget ? 1 - flash * 0.04 : 1})`,
                  }}
                >
                  <div>
                    <div style={{ color: theme.color.fg, fontSize: 18, fontWeight: 600 }}>{r.name}</div>
                    <div style={{ color: theme.color.faint, fontSize: 14 }}>{r.sub}</div>
                  </div>
                  <div style={{ color: theme.color.brand, fontSize: 18, fontWeight: 700 }}>
                    {r.kcal}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* logged toast */}
        {logged && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              bottom: 26,
              transform: `translateX(-50%) translateY(${(1 - toast) * 30}px)`,
              opacity: toast,
              padding: "14px 24px",
              borderRadius: 999,
              background: theme.color.brand,
              color: theme.color.brandDeep,
              fontFamily,
              fontWeight: 800,
              fontSize: 19,
              boxShadow: `0 12px 40px ${theme.color.brand}66`,
              whiteSpace: "nowrap",
            }}
          >
            ✓ Ubeleženo · +165 kcal
          </div>
        )}
      </PhoneFrame>
    </div>
  );

  const copy = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 22,
        maxWidth: vertical ? 720 : 600,
        alignItems: vertical ? "center" : "flex-start",
        textAlign: vertical ? "center" : "left",
      }}
    >
      <Kicker text="Dodaj" delay={4} />
      <KineticText
        text="Obrok za *nekoliko* sekundi."
        delay={10}
        size={vertical ? 60 : 74}
        align={vertical ? "center" : "left"}
      />
      <div style={{ fontFamily, fontSize: 26, color: theme.color.muted, fontWeight: 500, lineHeight: 1.4 }}>
        Pretraži deljeni katalog, izaberi porciju i gotovo. Barkod i foto obroka — uskoro.
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
              {copy}
              {phone}
            </>
          )}
        </AbsoluteFill>
      </Background>
    </AbsoluteFill>
  );
};
