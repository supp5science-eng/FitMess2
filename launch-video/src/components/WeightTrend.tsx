import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { fontFamily } from "../fonts";
import { theme } from "../theme";

// A gently descending weight series (kg) — the smoothed trend the app shows,
// not scary daily noise. Trends toward the goal line.
const SERIES = [
  84.2, 84.4, 83.9, 83.6, 83.8, 83.1, 82.9, 82.6, 82.7, 82.1, 81.8, 81.9, 81.3, 81.0, 80.6,
];
const GOAL = 79;

/**
 * The `/analitika` weight-trend chart: a smoothed line that draws itself on
 * left-to-right, plus a dashed goal line. Area under the curve fades in.
 */
export const WeightTrend: React.FC<{
  width?: number;
  height?: number;
  delay?: number;
}> = ({ width = 620, height = 300, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const padX = 18;
  const padY = 26;
  const min = Math.min(GOAL, ...SERIES) - 0.6;
  const max = Math.max(...SERIES) + 0.6;

  const x = (i: number) => padX + (i / (SERIES.length - 1)) * (width - padX * 2);
  const y = (v: number) => padY + (1 - (v - min) / (max - min)) * (height - padY * 2);

  const line = SERIES.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");
  const area = `${line} L${x(SERIES.length - 1)},${height - padY} L${x(0)},${height - padY} Z`;

  const draw = spring({ frame: frame - delay, fps, config: { damping: 200, stiffness: 70 } });
  const areaOpacity = interpolate(frame, [delay + 20, delay + 45], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const goalOpacity = interpolate(frame, [delay + 30, delay + 45], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <svg width={width} height={height} style={{ overflow: "visible", fontFamily }}>
      <defs>
        <linearGradient id="wt-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={theme.color.brand} stopOpacity={0.32} />
          <stop offset="100%" stopColor={theme.color.brand} stopOpacity={0} />
        </linearGradient>
      </defs>

      {/* goal line */}
      <line
        x1={padX}
        x2={width - padX}
        y1={y(GOAL)}
        y2={y(GOAL)}
        stroke={theme.color.gold}
        strokeWidth={2}
        strokeDasharray="7 7"
        opacity={goalOpacity}
      />
      <text
        x={width - padX}
        y={y(GOAL) - 10}
        textAnchor="end"
        fill={theme.color.gold}
        fontSize={17}
        fontWeight={600}
        opacity={goalOpacity}
      >
        cilj {GOAL} kg
      </text>

      {/* area */}
      <path d={area} fill="url(#wt-area)" opacity={areaOpacity} />

      {/* trend line, drawing on */}
      <path
        d={line}
        pathLength={1}
        fill="none"
        stroke={theme.color.brand}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={1}
        strokeDashoffset={1 - draw}
        style={{ filter: `drop-shadow(0 0 8px ${theme.color.brand}66)` }}
      />

      {/* leading dot */}
      {draw > 0.02 && (
        <circle
          cx={x((SERIES.length - 1) * draw)}
          cy={y(
            SERIES[Math.min(SERIES.length - 1, Math.round((SERIES.length - 1) * draw))],
          )}
          r={7}
          fill={theme.color.fg}
          stroke={theme.color.brand}
          strokeWidth={3}
        />
      )}
    </svg>
  );
};

/** Per-day calorie bars with a dashed target line — the weekly budget view. */
export const WeeklyBars: React.FC<{
  width?: number;
  height?: number;
  delay?: number;
}> = ({ width = 620, height = 300, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const days = ["P", "U", "S", "Č", "P", "S", "N"];
  const values = [0.82, 1.04, 0.71, 0.93, 0.88, 1.12, 0.6]; // fraction of target
  const target = 0.95;
  const gap = 22;
  const barW = (width - gap * (days.length - 1)) / days.length;
  const maxH = height - 40;

  return (
    <svg width={width} height={height} style={{ overflow: "visible", fontFamily }}>
      {/* target line */}
      <line
        x1={0}
        x2={width}
        y1={height - 24 - target * maxH}
        y2={height - 24 - target * maxH}
        stroke={theme.color.faint}
        strokeWidth={2}
        strokeDasharray="6 6"
      />
      {values.map((v, i) => {
        const t = spring({
          frame: frame - delay - i * 4,
          fps,
          config: { damping: 200, stiffness: 110 },
        });
        const h = v * maxH * t;
        const over = v > target;
        return (
          <g key={i}>
            <rect
              x={i * (barW + gap)}
              y={height - 24 - h}
              width={barW}
              height={h}
              rx={8}
              fill={over ? theme.color.gold : theme.color.brand}
              opacity={0.95}
            />
            <text
              x={i * (barW + gap) + barW / 2}
              y={height - 4}
              textAnchor="middle"
              fill={theme.color.muted}
              fontSize={17}
              fontWeight={600}
            >
              {days[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
