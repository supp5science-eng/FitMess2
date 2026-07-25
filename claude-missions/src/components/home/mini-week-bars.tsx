"use client";

import { cn } from "@/lib/utils";

// The 7-day strip at the foot of the Koraci / Voda cards on `/danas`
// (2026-07-25). Seven slim bars, Pon..Ned oldest -> the day being viewed, each
// filled by that day's share of the goal, with a faint line where the goal sits.
//
// Why it exists: the home pager's pages all share the tallest page's height, so
// the (short) Koraci/Voda page always had leftover space. Rather than spreading
// the cards apart to swallow it -- which is what read as "everything is
// floating" -- the space now carries the one thing the card was missing: whether
// today is normal for you. The data is the SAME `computeStepsWeek` /
// `computeWaterWeek` the Analitika cards use, so home and analytics can never
// tell different stories.
//
// Purely presentational: the caller passes already-derived days.

export interface MiniWeekDay {
  /** Short Serbian weekday label, "Pon".."Ned". */
  label: string;
  /** This day's value vs the goal, 0..1 (clamped by the caller or here). */
  pct: number;
  /** The day being viewed (highlighted). */
  isToday: boolean;
}

export function MiniWeekBars({
  days,
  barClassName,
  trackClassName,
  todayLabelClassName,
  testId,
}: {
  days: MiniWeekDay[];
  /** Fill colour of a bar (violet for Koraci, sky for Voda). */
  barClassName: string;
  /** The empty part of a bar. */
  trackClassName: string;
  /** Colour of the current day's weekday label. */
  todayLabelClassName: string;
  testId: string;
}) {
  if (days.length === 0) return null;

  return (
    <div data-testid={testId} className="flex items-end gap-1.5">
      {days.map((day, index) => {
        const pct = Math.max(0, Math.min(1, day.pct));
        return (
          <div
            key={`${day.label}-${index}`}
            className="flex flex-1 flex-col items-center gap-1"
          >
            {/* A slim column, not a block: the track's full height IS the goal,
                so a bar that reaches the top is a day that met it -- no extra
                rule needed. Kept narrow (10px) on purpose; at full cell width
                the bars read as lozenges rather than a chart. */}
            <span
              className={cn(
                "flex h-10 w-2.5 items-end overflow-hidden rounded-full",
                trackClassName
              )}
              aria-hidden="true"
            >
              <span
                data-testid="mini-week-bar"
                className={cn(
                  "block w-full rounded-full transition-[height] duration-500",
                  barClassName,
                  // A logged-but-tiny day still has to be visible as a sliver.
                  pct > 0 ? "min-h-[4px]" : "min-h-0"
                )}
                style={{ height: `${pct * 100}%` }}
              />
            </span>
            <span
              className={cn(
                "text-[0.6rem] font-medium leading-none",
                day.isToday ? todayLabelClassName : "text-muted-foreground/60"
              )}
            >
              {day.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
