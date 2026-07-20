import React from "react";
import { useCurrentFrame, spring, useVideoConfig, interpolate } from "remotion";
import { theme } from "../theme";
import { interFamily } from "../fonts";

/**
 * The app's signature calorie ring — the same "consumed vs remaining" gauge
 * from /danas — animated filling from 0 to `target`.
 */
export const CalorieRing: React.FC<{
  size?: number;
  consumed?: number;
  target?: number;
  startAt?: number;
}> = ({ size = 460, consumed = 1680, target = 2100, startAt = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - startAt,
    fps,
    config: { damping: 200, stiffness: 60 },
    durationInFrames: 55,
  });

  const stroke = size * 0.09;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = (consumed / target) * progress;
  const shownKcal = Math.round(consumed * progress);
  const remaining = Math.max(0, target - shownKcal);

  const numberScale = interpolate(progress, [0, 1], [0.9, 1]);

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        {/* track */}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={theme.bgCard} strokeWidth={stroke} />
        {/* fill */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={theme.brand}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ filter: `drop-shadow(0 0 ${stroke}px ${theme.brand}88)` }}
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
          fontFamily: interFamily,
          transform: `scale(${numberScale})`,
        }}
      >
        <div style={{ color: theme.muted, fontSize: size * 0.05, fontWeight: 600, letterSpacing: 1 }}>
          POJEDENO
        </div>
        <div style={{ color: theme.fg, fontSize: size * 0.17, fontWeight: 700, lineHeight: 1 }}>
          {shownKcal.toLocaleString("sr-RS")}
        </div>
        <div style={{ color: theme.brandSoft, fontSize: size * 0.055, fontWeight: 600, marginTop: size * 0.02 }}>
          još {remaining.toLocaleString("sr-RS")} kcal
        </div>
      </div>
    </div>
  );
};
