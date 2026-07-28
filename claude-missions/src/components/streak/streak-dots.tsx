import type { StreakDay } from "@/lib/streak/streak";
import { cn } from "@/lib/utils";

// The little week-at-a-glance dot row shared by the home streak card and the
// Analitika streak card: one dot per recent day, warm-filled when a meal was
// logged that day, hollow when not. Today gets its own treatment -- a soft
// dashed ring while still empty (an invitation, never a scolding) and a haloed
// fill once logged. Purely decorative (`aria-hidden` dots); the row as a whole
// carries one honest text label for screen readers, and the surrounding card
// always states the streak in words.

const SR_WEEKDAY_SHORT = ["ned", "pon", "uto", "sre", "čet", "pet", "sub"];

/** `"2026-07-28"` -> `"uto"`. Pure calendar arithmetic on the key (already a
 * Belgrade day), never a timezone read. */
function weekdayShort(dayKey: string): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  const index = new Date(Date.UTC(year!, month! - 1, day!)).getUTCDay();
  return SR_WEEKDAY_SHORT[index]!;
}

export function StreakDots({
  days,
  showLabels = false,
  className,
}: {
  days: StreakDay[];
  /** Draw the Serbian weekday initial under each dot (Analitika card). */
  showLabels?: boolean;
  className?: string;
}) {
  const loggedCount = days.filter((day) => day.logged).length;

  return (
    <div
      role="img"
      aria-label={`${loggedCount} od poslednjih ${days.length} dana sa unosom`}
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
                ? "bg-orange-500"
                : day.isToday
                  ? "border-2 border-dashed border-orange-400/60"
                  : "border border-border bg-transparent",
              day.logged &&
                day.isToday &&
                "ring-2 ring-orange-500/30 ring-offset-1 ring-offset-card"
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
              {weekdayShort(day.dayKey)}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
