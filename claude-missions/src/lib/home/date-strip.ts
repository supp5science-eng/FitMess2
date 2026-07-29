import { belgradeWeekdayIndex, toBelgradeCalendarDay } from "@/lib/dates";

/**
 * One day cell in the dashboard's date strip (the Cal-AI-style row of days
 * under the wordmark). Purely presentational data -- all timezone/calendar
 * reasoning happens here, server-side, so the client component just renders.
 */
export interface DayCell {
  /** Belgrade calendar day, `"YYYY-MM-DD"` -- the strip's stable key + link param. */
  key: string;
  /** Serbian short weekday, `Pon`..`Ned`. */
  dayLabel: string;
  /** Weekday index, 0=Mon..6=Sun -- lets the view resolve a localized label. */
  weekdayIndex: number;
  /** Day-of-month number, 1..31. */
  dayNum: number;
  /** This cell is today (Belgrade). */
  isToday: boolean;
  /** This cell is in the future (after today) -- shown faint, not tappable. */
  isFuture: boolean;
  /** This cell is before the user's sign-up day -- an "imaginary" filler day
   * that exists only so today can sit centered. Faint, not tappable. */
  isBeforeStart: boolean;
  /** The user logged at least one meal on this (past) day -- drives the faded
   * teal ring. Today is always shown green regardless (handled in the view). */
  isLogged: boolean;
  /** This is the day currently being viewed. */
  isSelected: boolean;
  /**
   * How full this day's mini progress ring is, `0..1` -- that day's logged
   * kcal over the daily target (Apple-Fitness-style weekly rings, 2026-07-22
   * redesign). Disabled (future / pre-sign-up) days are always 0. When no
   * per-day kcal data or no positive target is supplied, a logged day
   * degrades to a FULL ring (1) so it still reads as "done".
   */
  fillFraction: number;
}

// EU/Serbian convention: week starts Monday. `belgradeWeekdayIndex` returns
// Monday = 0 ... Sunday = 6, matching these indices.
const SR_WEEKDAYS_SHORT = ["Pon", "Uto", "Sre", "Čet", "Pet", "Sub", "Ned"];

/**
 * Builds the date strip's day cells over the inclusive range `[startKey,
 * endKey]` (both `"YYYY-MM-DD"`). `startKey` is the earliest viewable day
 * (the user's sign-up day); `endKey` is today + N future days (the strip
 * scrolls forward through them even though they're empty). `loggedDays` is the
 * set of days with at least one meal logged; `selectedKey` is the day being
 * viewed. Days after today are marked `isFuture` (faint, not tappable) and are
 * never "logged" or "selected".
 */
export function buildDateStrip({
  now = new Date(),
  selectedKey,
  loggedDays,
  startKey,
  endKey,
  minKey,
  dayKcals,
  targetKcal,
}: {
  now?: Date;
  selectedKey: string;
  loggedDays: Set<string>;
  startKey: string;
  endKey: string;
  /** The user's sign-up day (`"YYYY-MM-DD"`). Days before it are "imaginary"
   * filler (disabled). Omitted -> every in-range day is real. */
  minKey?: string;
  /** Summed logged kcal per Belgrade day -- drives each day's mini-ring fill
   * together with `targetKcal`. Omitted -> logged days show a full ring. */
  dayKcals?: Map<string, number>;
  /** The daily kcal target the mini rings fill against (today's target is
   * used for every day -- close enough for an at-a-glance weekly row). */
  targetKcal?: number;
}): DayCell[] {
  const todayKey = toBelgradeCalendarDay(now);
  const [year, month, day] = startKey.split("-").map(Number);

  const cells: DayCell[] = [];
  for (let offset = 0; ; offset++) {
    // Noon UTC on the target Y-M-D is always safely inside that same Belgrade
    // calendar day (offset +1/+2h), so it's a robust representative instant.
    const instant = new Date(Date.UTC(year!, month! - 1, day! + offset, 12));
    const key = toBelgradeCalendarDay(instant);
    if (key > endKey) break;

    const isFuture = key > todayKey;
    const isBeforeStart = minKey !== undefined && key < minKey;
    const disabled = isFuture || isBeforeStart;
    const kcal = dayKcals?.get(key) ?? 0;
    const isLogged = !disabled && (loggedDays.has(key) || kcal > 0);
    let fillFraction = 0;
    if (!disabled) {
      if (targetKcal !== undefined && targetKcal > 0) {
        fillFraction = Math.min(1, Math.max(0, kcal / targetKcal));
      } else if (isLogged) {
        fillFraction = 1;
      }
    }
    cells.push({
      key,
      dayLabel: SR_WEEKDAYS_SHORT[belgradeWeekdayIndex(instant)]!,
      weekdayIndex: belgradeWeekdayIndex(instant),
      dayNum: Number(key.split("-")[2]),
      isToday: key === todayKey,
      isFuture,
      isBeforeStart,
      isLogged,
      fillFraction,
      // A disabled (future / pre-signup) day is never shown as selected.
      isSelected: key === selectedKey && !disabled,
    });
  }
  return cells;
}
