import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { fontFamily } from "../fonts";
import { theme } from "../theme";

/**
 * The FitMess mark — three crossing brush strokes (the "Ж"/hourglass figure
 * from the app icon), recreated as SVG so each stroke can draw itself on.
 * `pathLength={1}` normalises every path to length 1, so one dashoffset value
 * animates all three regardless of their real geometry.
 */
const STROKES = [
  // center (drawn last, on top) — the signature teal bar
  { d: "M50,10 C46,34 46,66 50,90", color: theme.color.brand, w: 9, order: 2 },
  // top-left → bottom-right
  { d: "M27,16 C41,40 59,60 73,86", color: theme.color.brandSoft, w: 8.5, order: 0 },
  // top-right → bottom-left
  { d: "M73,16 C59,40 41,60 27,86", color: "#ffffff", w: 8.5, order: 1 },
];

export const LogoMark: React.FC<{
  size?: number;
  delay?: number;
  /** frames each stroke takes to draw. */
  drawDuration?: number;
}> = ({ size = 200, delay = 0, drawDuration = 22 }) => {
  const frame = useCurrentFrame();

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ overflow: "visible" }}>
      <defs>
        <filter id="logoGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {STROKES.map((s, i) => {
        const start = delay + s.order * (drawDuration * 0.55);
        const p = interpolate(frame, [start, start + drawDuration], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <path
            key={i}
            d={s.d}
            pathLength={1}
            fill="none"
            stroke={s.color}
            strokeWidth={s.w}
            strokeLinecap="round"
            strokeDasharray={1}
            strokeDashoffset={1 - p}
            filter="url(#logoGlow)"
          />
        );
      })}
    </svg>
  );
};

/** Mark + "FitMess" wordmark, laid out horizontally or stacked. */
export const Logo: React.FC<{
  size?: number;
  delay?: number;
  layout?: "row" | "stack";
  wordmark?: boolean;
}> = ({ size = 120, delay = 0, layout = "row", wordmark = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const wordDelay = delay + 26;
  const t = spring({ frame: frame - wordDelay, fps, config: { damping: 200 } });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: layout === "row" ? "row" : "column",
        alignItems: "center",
        gap: layout === "row" ? size * 0.28 : size * 0.14,
      }}
    >
      <LogoMark size={size} delay={delay} />
      {wordmark && (
        <div
          style={{
            fontFamily,
            fontWeight: 800,
            fontSize: size * 0.62,
            letterSpacing: -2,
            color: theme.color.fg,
            opacity: t,
            transform: `translateX(${(1 - t) * (layout === "row" ? -18 : 0)}px) translateY(${(1 - t) * (layout === "stack" ? 14 : 0)}px)`,
          }}
        >
          Fit<span style={{ color: theme.color.brand }}>Mess</span>
        </div>
      )}
    </div>
  );
};
