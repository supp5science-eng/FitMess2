"use client";

import { useT } from "@/components/i18n/locale-provider";
import type { StreakDay } from "@/lib/streak/streak";
import { cn } from "@/lib/utils";

// The little week-at-a-glance dot row shared by the home streak card and the
// Analitika streak card: one dot per recent day, warm-filled when a meal was
// logged that day, hollow when not. Today gets its own treatment -- a soft
// dashed ring while still empty (an invitation, never a scolding) and a haloed
// fill once logged. Purely decorative (`aria-hidden` dots); the row as a whole
// carries one honest text label for screen readers, and the surrounding card
// always states the streak in words.

const WEEKDAY_KEYS = [
  "media.streakDots.weekday.sun",
  "media.streakDots.weekday.mon",
  "media.streakDots.weekday.tue",
  "media.streakDots.weekday.wed",
  "media.streakDots.weekday.thu",
  "media.streakDots.weekday.fri",
  "media.streakDots.weekday.sat",
] as const;

/** `"2026-07-28"` -> weekday index (0 = Sunday). Pure calendar arithmetic on
 * the key (already a Belgrade day), never a timezone read. */
function weekdayIndex(dayKey: string): number {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!)).getUTCDay();
}

export function StreakDots({
  days,
  showLabels = false,
  className,
}: {
  days: StreakDay[];
  /** Draw the weekday initial under each dot (Analitika card). */
  showLabels?: boolean;
  className?: string;
}) {
  const { t } = useT();
  const loggedCount = days.filter((day) => day.logged).length;

  return (
    <div
      role="img"
      aria-label={t("media.streakDots.summaryAria", {
        logged: loggedCount,
        total: days.length,
      })}
      className={cn("flex items-start justify-between gap-1.5", className)}
    >
      {days.map((day) => (
        <div
          key={day.dayKey}
          className="flex flex-1 flex-col items-center gap-1.5"
        >
          <span
            aria-hidden="true"
            className={cn(
              "size-3.5 rounded-full transition-colors",
              day.logged
                ? "bg-[var(--streak-accent)]"
                : day.isToday
                  ? "border-2 border-dashed border-[var(--streak-line)]"
                  : "border border-border bg-transparent",
              day.logged &&
                day.isToday &&
                "ring-2 ring-[var(--streak-line)] ring-offset-1 ring-offset-card"
            )}
          />
          {showLabels ? (
            <span
              className={cn(
                "text-[11px] leading-none",
                day.isToday
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground"
              )}
            >
              {t(WEEKDAY_KEYS[weekdayIndex(day.dayKey)]!)}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}