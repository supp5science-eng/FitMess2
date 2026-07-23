"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { positionToPace } from "@/lib/onboarding/pace";
import { tickFeedback } from "@/lib/onboarding/tick";

/**
 * The `tempo` step's rotary "prsten" — a full-circle dial the user drags around
 * to pick ANY weight-change pace between the slow and fast bounds (Cal-AI
 * premium vibe, continuous, not three discrete cards). The visual is a colored
 * arc + a draggable handle; the color shifts olive-yellow → green → red as the
 * position moves toward slower/faster (the caller passes the current `color`).
 *
 * Accessibility: the visible ring is `aria-hidden`; the source of truth is a
 * visually-hidden native `<input type="range">` (labeled, keyboard-reachable,
 * what `getByLabelText`/AT drive). Both write the same `position` ∈ [0,1] up.
 */

const VIEW = 240; // viewBox size
const CENTER = VIEW / 2;
const RADIUS = 100; // track radius
const STROKE = 18;
const HANDLE_R = 15;

// The sweep: a full ring with a 60° gap at the bottom. t=0 (slow) sits at the
// bottom-left end, t=0.5 (recommended) at the very top, t=1 (fast) at the
// bottom-right end.
const START_DEG = -150;
const END_DEG = 150;
const SWEEP_DEG = END_DEG - START_DEG; // 300

/** Polar → cartesian with 0° at the TOP and positive degrees going clockwise
 * (screen coords, y-down). */
function polar(deg: number, r: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return {
    x: CENTER + r * Math.sin(rad),
    y: CENTER - r * Math.cos(rad),
  };
}

/** SVG arc path from `fromDeg` to `toDeg` (clockwise) at radius `r`. */
function arcPath(fromDeg: number, toDeg: number, r: number): string {
  const s = polar(fromDeg, r);
  const e = polar(toDeg, r);
  const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

function angleForT(t: number): number {
  return START_DEG + SWEEP_DEG * Math.min(1, Math.max(0, t));
}

export function PaceDial({
  position,
  onPositionChange,
  color,
  ariaLabel,
  ariaValueText,
  children,
}: {
  /** Current dial position, 0 (slow) … 1 (fast). */
  position: number;
  /** Fired continuously while dragging / on keyboard input. */
  onPositionChange: (t: number) => void;
  /** Accent color for the active arc + handle (from `paceRingColorAt`). */
  color: string;
  ariaLabel: string;
  ariaValueText: string;
  /** Center content (label + kcal readout). */
  children: ReactNode;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  // Fire a detent tick only when the nearest pace ZONE changes, so a slow drag
  // gives the same tactile "click" feel the old three-card step had.
  const lastZone = useRef(positionToPace(position));

  useEffect(() => {
    lastZone.current = positionToPace(position);
    // Only re-seed on mount / external position resets, never mid-drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function commitFromPointer(clientX: number, clientY: number) {
    const el = svgRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    // 0° at top, clockwise positive — matches `polar` above.
    const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;

    let t: number;
    if (deg > END_DEG) t = 1; // in the bottom gap, right side → fast end
    else if (deg < START_DEG) t = 0; // bottom gap, left side → slow end
    else t = (deg - START_DEG) / SWEEP_DEG;

    t = Math.min(1, Math.max(0, t));

    const zone = positionToPace(t);
    if (zone !== lastZone.current) {
      lastZone.current = zone;
      tickFeedback();
    }
    onPositionChange(t);
  }

  const handle = polar(angleForT(position), RADIUS);
  const active =
    position > 0.002 ? arcPath(START_DEG, angleForT(position), RADIUS) : null;
  const anchors = [0, 0.5, 1].map((t) => polar(angleForT(t), RADIUS));

  return (
    <div className="relative mx-auto w-full max-w-[280px] select-none">
      <div className="relative aspect-square w-full">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          className="h-full w-full touch-none"
          style={{ touchAction: "none" }}
          aria-hidden
          onPointerDown={(e) => {
            dragging.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            commitFromPointer(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (dragging.current) commitFromPointer(e.clientX, e.clientY);
          }}
          onPointerUp={(e) => {
            dragging.current = false;
            try {
              e.currentTarget.releasePointerCapture(e.pointerId);
            } catch {
              // capture may already be gone — ignore.
            }
          }}
          onPointerCancel={() => {
            dragging.current = false;
          }}
        >
          {/* Neutral track */}
          <path
            d={arcPath(START_DEG, END_DEG, RADIUS)}
            fill="none"
            stroke="var(--muted)"
            strokeWidth={STROKE}
            strokeLinecap="round"
          />

          {/* Anchor pips at slow / recommended / fast */}
          {anchors.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={2.5}
              fill="var(--muted-foreground)"
              opacity={0.5}
            />
          ))}

          {/* Active arc, colored by current position */}
          {active ? (
            <path
              d={active}
              fill="none"
              stroke={color}
              strokeWidth={STROKE}
              strokeLinecap="round"
            />
          ) : null}

          {/* Soft glow behind the handle */}
          <circle cx={handle.x} cy={handle.y} r={HANDLE_R + 8} fill={color} opacity={0.16} />

          {/* Handle */}
          <circle
            cx={handle.x}
            cy={handle.y}
            r={HANDLE_R}
            fill="var(--card)"
            stroke={color}
            strokeWidth={4}
            style={{ filter: "drop-shadow(0 2px 5px rgba(0,0,0,0.22))" }}
          />
          <circle cx={handle.x} cy={handle.y} r={4.5} fill={color} />
        </svg>

        {/* Center readout */}
        <div className="pointer-events-none absolute inset-0 grid place-items-center px-10 text-center">
          {children}
        </div>

        {/* Direction hints at the two gap ends */}
        <div className="pointer-events-none absolute inset-x-5 bottom-2 flex justify-between text-[11px] font-medium text-muted-foreground">
          <span>sporije</span>
          <span>brže</span>
        </div>
      </div>

      {/* Source of truth: accessible + keyboard + test-driven, visually hidden. */}
      <input
        type="range"
        min={0}
        max={1000}
        step={1}
        value={Math.round(Math.min(1, Math.max(0, position)) * 1000)}
        aria-label={ariaLabel}
        aria-valuetext={ariaValueText}
        onChange={(e) => onPositionChange(Number(e.target.value) / 1000)}
        className="sr-only"
      />
    </div>
  );
}
