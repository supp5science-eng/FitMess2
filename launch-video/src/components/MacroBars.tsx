import React from "react";
import { useCurrentFrame, useVideoConfig, spring } from "remotion";
import { fontFamily } from "../fonts";
import { theme } from "../theme";

type Macro = { label: string; value: number; target: number; color: string };

const DEFAULT: Macro[] = [
  { label: "Proteini", value: 118, target: 150, color: theme.color.protein },
  { label: "Ugljeni h.", value: 164, target: 220, color: theme.color.carbs },
  { label: "Masti", value: 52, target: 70, color: theme.color.fat },
];

/** The macro bars under the calorie ring — each fills to value/target. */
export const MacroBars: React.FC<{
  macros?: Macro[];
  delay?: number;
  width?: number;
}> = ({ macros = DEFAULT, delay = 0, width = 340 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div style={{ width, display: "flex", flexDirection: "column", gap: 18, fontFamily }}>
      {macros.map((m, i) => {
        const t = spring({
          frame: frame - delay - i * 6,
          fps,
          config: { damping: 200, stiffness: 90 },
        });
        const fill = (m.value / m.target) * t;
        return (
          <div key={m.label} style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: width * 0.045,
                color: theme.color.muted,
                fontWeight: 600,
              }}
            >
              <span>{m.label}</span>
              <span style={{ color: theme.color.faint }}>
                {Math.round(m.value * t)} / {m.target} g
              </span>
            </div>
            <div
              style={{
                height: width * 0.032,
                borderRadius: 999,
                background: theme.color.cardSoft,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, fill * 100)}%`,
                  height: "100%",
                  borderRadius: 999,
                  background: m.color,
                  boxShadow: `0 0 12px ${m.color}66`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
