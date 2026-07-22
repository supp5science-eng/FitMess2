"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import Link from "next/link";

import type { DayCell } from "@/lib/home/date-strip";
import { cn } from "@/lib/utils";

// Apple-Fitness-style date strip under the wordmark (2026-07-22 redesign): a
// horizontally scrollable row of days, each a MINI PROGRESS RING (filled by
// that day's logged kcal over the daily target, stroked with the brand-logo
// teal→mint→blue gradient) with the date number inside, under its Serbian
// weekday. An empty past day shows just the faint track; future days (up to
// +30) are faint and not tappable -- they exist only so you can scroll
// forward "through time." Today's weekday label sits in a brand-teal chip
// (like the reference design's highlighted weekday). The day currently being
// viewed sits on a raised card and is auto-centered on load. Tapping a
// past/today cell navigates to `/danas?dan=YYYY-MM-DD` (today links to bare
// `/danas`).

// useLayoutEffect on the client (position the scroll before paint -> no
// left-to-center jump), a no-op useEffect on the server.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const SR_MONTHS_SHORT = [
  "jan",
  "feb",
  "mar",
  "apr",
  "maj",
  "jun",
  "jul",
  "avg",
  "sep",
  "okt",
  "nov",
  "dec",
];

function accessibleLabel(cell: DayCell): string {
  const [, month, day] = cell.key.split("-").map(Number);
  const date = `${day}. ${SR_MONTHS_SHORT[month! - 1]}`;
  if (cell.isToday) return `Danas, ${date}`;
  return cell.isLogged ? `${date} — uneo si obrok` : date;
}

// Mini-ring geometry: a 40px box, ring radius/stroke sized so the day number
// stays readable inside. Same pathLength=100 dash technique as the big ring.
const MINI_BOX = 40;
const MINI_CENTER = MINI_BOX / 2;
const MINI_RADIUS = 17;
const MINI_STROKE = 3.5;

function DayCircle({ cell }: { cell: DayCell }) {
  const disabled = cell.isFuture || cell.isBeforeStart;
  const fraction = disabled ? 0 : cell.fillFraction;
  return (
    <span className="relative flex size-10 items-center justify-center">
      <svg
        viewBox={`0 0 ${MINI_BOX} ${MINI_BOX}`}
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <defs>
          {/* Same brand-logo gradient as the big daily ring (`ring.tsx`),
              duplicated per-cell -- identical stops, so whichever instance
              the id resolves to renders the same. */}
          <linearGradient id="fm-day-ring-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3ee6bf" />
            <stop offset="55%" stopColor="#17d1a8" />
            <stop offset="100%" stopColor="#2a9fd1" />
          </linearGradient>
        </defs>
        <circle
          cx={MINI_CENTER}
          cy={MINI_CENTER}
          r={MINI_RADIUS}
          fill="none"
          strokeWidth={MINI_STROKE}
          style={{
            stroke: disabled
              ? "color-mix(in srgb, var(--foreground) 8%, transparent)"
              : "color-mix(in srgb, #17d1a8 18%, transparent)",
          }}
        />
        {fraction > 0 ? (
          <circle
            cx={MINI_CENTER}
            cy={MINI_CENTER}
            r={MINI_RADIUS}
            fill="none"
            stroke="url(#fm-day-ring-gradient)"
            strokeWidth={MINI_STROKE}
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={100}
            strokeDashoffset={100 - fraction * 100}
            transform={`rotate(-90 ${MINI_CENTER} ${MINI_CENTER})`}
          />
        ) : null}
      </svg>
      <span
        className={cn(
          "relative text-sm font-semibold tabular-nums",
          disabled
            ? "text-foreground/30"
            : cell.isToday || cell.isLogged
              ? "text-foreground"
              : "text-muted-foreground"
        )}
      >
        {cell.dayNum}
      </span>
    </span>
  );
}

function DayCellInner({ cell }: { cell: DayCell }) {
  return (
    <span
      className={cn(
        "flex flex-col items-center gap-2 rounded-2xl px-1 py-2 transition-colors",
        cell.isSelected && "bg-foreground/[0.06] ring-1 ring-foreground/10"
      )}
    >
      <span
        className={cn(
          "text-xs font-medium",
          cell.isToday
            ? // Today's weekday sits in a brand-teal chip, like the
              // highlighted weekday in the reference design.
              "rounded-full bg-[color:var(--brand)] px-2 py-0.5 font-semibold text-[#04231c]"
            : cell.isFuture || cell.isBeforeStart
              ? "text-foreground/30"
              : cell.isSelected
                ? "text-foreground"
                : "text-muted-foreground"
        )}
      >
        {cell.dayLabel}
      </span>
      <DayCircle cell={cell} />
    </span>
  );
}

export function DateStrip({ days }: { days: DayCell[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLElement | null>(null);

  // Center the selected (today by default) day in the viewport on load.
  useIsomorphicLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const sel = selectedRef.current;
    if (!scroller || !sel) return;
    const cRect = scroller.getBoundingClientRect();
    const sRect = sel.getBoundingClientRect();
    scroller.scrollLeft +=
      sRect.left - cRect.left - (scroller.clientWidth - sel.offsetWidth) / 2;
  }, []);

  return (
    <div
      ref={scrollerRef}
      aria-label="Izbor dana"
      role="navigation"
      className="-mx-1 flex snap-x gap-0.5 overflow-x-auto overscroll-x-contain px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {days.map((cell) => {
        const setRef = cell.isSelected
          ? (el: HTMLElement | null) => {
              selectedRef.current = el;
            }
          : undefined;

        return cell.isFuture || cell.isBeforeStart ? (
          <div
            key={cell.key}
            className="w-14 shrink-0 snap-center"
            aria-hidden="true"
          >
            <DayCellInner cell={cell} />
          </div>
        ) : (
          <Link
            key={cell.key}
            ref={setRef}
            href={cell.isToday ? "/danas" : `/danas?dan=${cell.key}`}
            aria-label={accessibleLabel(cell)}
            aria-current={cell.isSelected ? "page" : undefined}
            className="w-14 shrink-0 snap-center rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <DayCellInner cell={cell} />
          </Link>
        );
      })}
    </div>
  );
}
