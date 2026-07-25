"use client";

import { useId } from "react";

import { cn } from "@/lib/utils";

// A circular progress ring with a gradient stroke, shared by the Koraci and Voda
// cards on `/danas` (2026-07-25). Lifted out of `steps-card.tsx` when the two
// cards were redesigned to look like one family: same ring, same geometry, only
// the gradient differs (violet for steps, sky for water).
//
// `fraction` (0..1, clamped) drives the fill; the caller places whatever it
// wants in the centre. Decorative by design (`aria-hidden`) — the surrounding
// card always states the numbers in text.

export function ProgressRing({
  fraction,
  size,
  stroke,
  trackClassName,
  gradient,
  children,
}: {
  fraction: number;
  size: number;
  stroke: number;
  /** Tailwind text-* colour for the unfilled track (drawn with `currentColor`). */
  trackClassName: string;
  /** Three stops of the filled arc, light -> dark. */
  gradient: [string, string, string];
  children?: React.ReactNode;
}) {
  const gradientId = useId();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, fraction));
  const offset = c * (1 - clamped);

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={gradient[0]} />
            <stop offset="55%" stopColor={gradient[1]} />
            <stop offset="100%" stopColor={gradient[2]} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          className={cn(trackClassName)}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 0.45s cubic-bezier(0.2,0,0,1)",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}
