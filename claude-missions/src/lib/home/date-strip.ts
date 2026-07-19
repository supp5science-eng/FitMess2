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
}: {
  now?: Date;
  selectedKey: string;
  loggedDays: Set<string>;
  startKey: string;
  endKey: string;
  /** The user's sign-up day (`"YYYY-MM-DD"`). Days before it are "imaginary"
   * filler (disabled). Omitted -> every in-range day is real. */
  minKey?: string;
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
    cells.push({
      key,
      dayLabel: SR_WEEKDAYS_SHORT[belgradeWeekdayIndex(instant)]!,
      dayNum: Number(key.split("-")[2]),
      isToday: key === todayKey,
      isFuture,
      isBeforeStart,
      isLogged: !disabled && loggedDays.has(key),
      // A disabled (future / pre-signup) day is never shown as selected.
      isSelected: key === selectedKey && !disabled,
    });
  }
  return cells;
}
