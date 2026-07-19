"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import Link from "next/link";

import type { DayCell } from "@/lib/home/date-strip";
import { cn } from "@/lib/utils";

// Cal-AI-style date strip under the wordmark: a horizontally scrollable row of
// days, each a circled date number under its Serbian weekday. A day the user
// logged a meal gets a solid teal ring; an empty past day gets a dashed ring;
// future days (up to +30) are faint and not tappable -- they exist only so you
// can scroll forward "through time." The day currently being viewed sits on a
// raised card and is auto-centered on load. Tapping a past/today cell
// navigates to `/danas?dan=YYYY-MM-DD` (today links to bare `/danas`).

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

function DayCircle({ cell }: { cell: DayCell }) {
  const disabled = cell.isFuture || cell.isBeforeStart;
  return (
    <span
      className={cn(
        "flex size-10 items-center justify-center rounded-full border text-sm font-semibold tabular-nums transition-colors",
        cell.isToday
          ? // Today is ALWAYS green (full teal), even before anything is logged.
            "border-2 border-primary text-foreground"
          : cell.isLogged
            ? // A past day with a meal logged -- a FADED teal ring, so it reads
              // as "done, but not today".
              "border-2 border-primary/40 text-foreground"
            : disabled
              ? "border border-dashed border-foreground/15 text-foreground/30"
              : "border border-dashed border-foreground/30 text-muted-foreground"
      )}
    >
      {cell.dayNum}
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
          cell.isFuture || cell.isBeforeStart
            ? "text-foreground/30"
            : cell.isToday || cell.isSelected
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
