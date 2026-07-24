import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { fontFamily } from "../fonts";
import { theme } from "../theme";

/**
 * The `/danas` calorie ring — hand-drawn SVG arc like the app's, with the
 * remaining-kcal number counting up in the middle. `progress` is 0..1 of the
 * daily budget consumed.
 */
export const CalorieRing: React.FC<{
  size?: number;
  progress?: number; // fraction of budget consumed
  budget?: number;
  delay?: number;
  label?: string;
}> = ({ size = 340, progress = 0.62, budget = 2100, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const stroke = size * 0.085;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  const grow = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200, stiffness: 90, mass: 1 },
  });
  const shown = progress * grow;
  const consumed = Math.round(budget * shown);
  const remaining = Math.max(0, budget - consumed);

  const pop = spring({ frame: frame - delay, fps, config: { damping: 12, stiffness: 120 } });

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        transform: `scale(${interpolate(pop, [0, 1], [0.9, 1])})`,
      }}
    >
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={theme.color.cardSoft}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={theme.color.brand}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - shown)}
          style={{ filter: `drop-shadow(0 0 ${stroke * 0.6}px ${theme.color.brand}88)` }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily,
        }}
      >
        <div style={{ color: theme.color.muted, fontSize: size * 0.052, fontWeight: 600 }}>
          preostalo
        </div>
        <div
          style={{
            color: theme.color.fg,
            fontSize: size * 0.2,
            fontWeight: 800,
            letterSpacing: -2,
            lineHeight: 1,
          }}
        >
          {remaining.toLocaleString("sr-RS")}
        </div>
        <div style={{ color: theme.color.faint, fontSize: size * 0.05, fontWeight: 500 }}>
          od {budget.toLocaleString("sr-RS")} kcal
        </div>
      </div>
    </div>
  );
};
