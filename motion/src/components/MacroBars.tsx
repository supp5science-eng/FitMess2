import React from "react";
import { useCurrentFrame, spring, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { interFamily } from "../fonts";

type Macro = { label: string; value: number; target: number; color: string };

const MACROS: Macro[] = [
  { label: "Proteini", value: 118, target: 150, color: theme.macro.protein },
  { label: "Masti", value: 52, target: 70, color: theme.macro.fat },
  { label: "UH", value: 190, target: 240, color: theme.macro.carbs },
];

export const MacroBars: React.FC<{ width?: number; startAt?: number }> = ({
  width = 620,
  startAt = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div style={{ width, display: "flex", flexDirection: "column", gap: 26, fontFamily: interFamily }}>
      {MACROS.map((m, i) => {
        const p = spring({
          frame: frame - startAt - i * 6,
          fps,
          config: { damping: 200, stiffness: 70 },
          durationInFrames: 45,
        });
        const pct = Math.min(1, m.value / m.target) * p;
        return (
          <div key={m.label} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26 }}>
              <span style={{ color: theme.fg, fontWeight: 600 }}>{m.label}</span>
              <span style={{ color: theme.muted }}>
                {Math.round(m.value * p)}
                <span style={{ opacity: 0.5 }}> / {m.target} g</span>
              </span>
            </div>
            <div
              style={{
                height: 16,
                borderRadius: 999,
                background: theme.bgCard,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${pct * 100}%`,
                  borderRadius: 999,
                  background: m.color,
                  boxShadow: `0 0 18px ${m.color}77`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
