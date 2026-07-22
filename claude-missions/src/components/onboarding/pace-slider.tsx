"use client";

import { useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";

import {
  PACE_LABELS,
  PACE_ORDER,
  paceColorAt,
  paceToPosition,
  positionToPace,
  type WeightChangePace,
} from "@/lib/onboarding/pace";

/**
 * A smooth, colorful pace slider for the "how fast?" step.
 *
 * The thumb drags continuously (following the finger) and snaps to the nearest
 * of the three paces on release, gliding into place. Its color tells the story
 * as you move: a dull olive-yellow toward "sporo" (too slow), the nicest vivid
 * green in the recommended middle, and an alarming red toward "brzo" (too
 * aggressive) — see `paceColorAt`. The track shows that whole spectrum so the
 * green middle reads as the sweet spot at a glance.
 *
 * Accessible: it's a proper ARIA slider (role, value, keyboard). The onboarding
 * data stays discrete (slow/recommended/fast); only the interaction is smooth.
 */
export function PaceSlider({
  value,
  onChange,
}: {
  value: WeightChangePace;
  onChange: (pace: WeightChangePace) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragT, setDragT] = useState<number | null>(null);

  const dragging = dragT !== null;
  const t = dragT ?? paceToPosition(value);
  const color = paceColorAt(t);

  function tFromClientX(clientX: number): number {
    const el = trackRef.current;
    if (!el) return t;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return t;
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragT(tFromClientX(e.clientX));
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (dragT === null) return;
    setDragT(tFromClientX(e.clientX));
  }

  function handlePointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (dragT === null) return;
    const snapped = positionToPace(tFromClientX(e.clientX));
    setDragT(null);
    onChange(snapped);
  }

  function step(delta: number) {
    const i = PACE_ORDER.indexOf(value);
    const next = Math.min(PACE_ORDER.length - 1, Math.max(0, i + delta));
    if (next !== i) onChange(PACE_ORDER[next]);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      step(1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      step(-1);
    } else if (e.key === "Home") {
      e.preventDefault();
      onChange(PACE_ORDER[0]);
    } else if (e.key === "End") {
      e.preventDefault();
      onChange(PACE_ORDER[PACE_ORDER.length - 1]);
    }
  }

  // Track spectrum: dull-yellow (slow) → light neutral (recommended) → red
  // (fast). A light grey centre (not pure white) keeps it visible on the page
  // and lets the white default thumb read against it.
  const trackGradient = `linear-gradient(90deg, ${paceColorAt(
    0
  )} 0%, #e6e6ea 50%, ${paceColorAt(1)} 100%)`;

  return (
    <div
      className="relative flex h-11 w-full touch-none select-none items-center"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Track — the full slow→recommended→fast spectrum */}
      <div
        ref={trackRef}
        className="relative h-2.5 w-full rounded-full"
        style={{ background: trackGradient, opacity: 0.85 }}
      >
        {/* Anchor ticks at slow / recommended / fast */}
        {PACE_ORDER.map((_, i) => (
          <span
            key={i}
            className="absolute top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70"
            style={{ left: `${(i / (PACE_ORDER.length - 1)) * 100}%` }}
          />
        ))}
      </div>

      {/* Thumb */}
      <div
        role="slider"
        tabIndex={0}
        aria-label="Tempo dostizanja cilja"
        aria-valuemin={0}
        aria-valuemax={PACE_ORDER.length - 1}
        aria-valuenow={PACE_ORDER.indexOf(value)}
        aria-valuetext={PACE_LABELS[value]}
        onKeyDown={handleKeyDown}
        className="absolute top-1/2 size-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--pace-c)] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        style={
          {
            left: `${t * 100}%`,
            "--pace-c": color,
            // A crisp neutral outline + drop shadow keep the (white by default)
            // thumb readable, plus a soft colored halo once it's off-centre.
            boxShadow: `inset 0 0 0 1px rgba(0,0,0,0.08), 0 0 0 ${
              dragging ? 9 : 5
            }px color-mix(in srgb, ${color} 24%, transparent), 0 3px 12px -2px rgba(0,0,0,0.28)`,
            transform: `translate(-50%, -50%) scale(${dragging ? 1.12 : 1})`,
            transition: dragging
              ? "box-shadow .15s ease"
              : "left .35s cubic-bezier(0.22,1,0.36,1), background-color .2s ease, box-shadow .2s ease, transform .15s ease",
          } as CSSProperties
        }
      />

    </div>
  );
}
