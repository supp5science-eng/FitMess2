import type { CSSProperties } from "react";

import "./intro-cover.css";

// The second half of the onboarding "ring hand-off": a full-screen cover that
// carries the plan-reveal's ring straight into `/danas`.
//
// It is deliberately presentational and hook-free so BOTH sides of the hard
// navigation can render it:
//   - `danas/loading.tsx` (Server Component) renders it static, at `stage
//     "cover"`, while the page's data is in flight -- this replaces the
//     skeleton for onboarding arrivals so there is no flash between the
//     reveal's final frame and the dashboard.
//   - `HomeScreen` (Client Component) renders it as an overlay and drives
//     `stage` through cover -> glide -> land, feeding a measured `shift` so
//     the ghost ring glides from the viewport centre onto the real daily
//     ring's position before cross-fading away.
//
// The ghost ring intentionally mirrors the reveal ring exactly (232px box,
// r=88 / stroke 12, ~90% arc, the same big tabular kcal number) so the
// centre value never visibly jumps -- on day zero the dashboard's own ring
// shows `Preostalo = the full target`, i.e. the very same number.

export type IntroStage = "cover" | "glide" | "land";

const R = 88;
const CIRCUMFERENCE = 2 * Math.PI * R; // ~553

export function IntroCover({
  stage,
  kcal,
  shift = 0,
}: {
  stage: IntroStage;
  kcal: number;
  shift?: number;
}) {
  return (
    <div
      className="di"
      data-stage={stage}
      aria-hidden="true"
      style={{ "--di-shift": `${shift}px` } as CSSProperties}
    >
      <div className="di-ghost">
        <svg viewBox="0 0 200 200">
          <circle
            className="di-track"
            cx="100"
            cy="100"
            r={R}
            fill="none"
            strokeWidth="12"
          />
          <circle
            className="di-arc"
            cx="100"
            cy="100"
            r={R}
            fill="none"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
          />
        </svg>
        <div className="di-center">
          <div className="di-kcal">{kcal.toLocaleString("sr-RS")}</div>
          <div className="di-unit">kcal dnevno</div>
        </div>
      </div>
    </div>
  );
}
