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
  /** This cell is before the user's sign-up day -- the earliest viewable day.
   * Shown faint and not tappable, like a future day. */
  isBeforeStart: boolean;
  /** The user logged at least one meal on this day (drives the teal ring). */
  isLogged: boolean;
  /** This is the day currently being viewed. */
  isSelected: boolean;
}

// EU/Serbian convention: week starts Monday. `belgradeWeekdayIndex` returns
// Monday = 0 ... Sunday = 6, matching these indices.
const SR_WEEKDAYS_SHORT = ["Pon", "Uto", "Sre", "Čet", "Pet", "Sub", "Ned"];

/**
 * Builds the date strip's day cells: a fixed window of `past` days before today
 * through `future` days after (default 5 before + today + 1 after = 7, matching
 * the reference layout). `loggedDays` is the set of `"YYYY-MM-DD"` days that
 * have at least one meal logged; `selectedKey` is the day currently viewed.
 */
export function buildDateStrip({
  now = new Date(),
  selectedKey,
  loggedDays,
  minKey,
  past = 5,
  future = 1,
}: {
  now?: Date;
  selectedKey: string;
  loggedDays: Set<string>;
  /** The user's sign-up day (`"YYYY-MM-DD"`) -- the earliest viewable day. */
  minKey?: string;
  past?: number;
  future?: number;
}): DayCell[] {
  const todayKey = toBelgradeCalendarDay(now);
  const [year, month, day] = todayKey.split("-").map(Number);

  const cells: DayCell[] = [];
  for (let offset = -past; offset <= future; offset++) {
    // Noon UTC on the target Y-M-D is always safely inside that same Belgrade
    // calendar day (offset +1/+2h), so it's a robust representative instant.
    const instant = new Date(Date.UTC(year!, month! - 1, day! + offset, 12));
    const key = toBelgradeCalendarDay(instant);
    const isFuture = key > todayKey;
    const isBeforeStart = minKey !== undefined && key < minKey;
    cells.push({
      key,
      dayLabel: SR_WEEKDAYS_SHORT[belgradeWeekdayIndex(instant)]!,
      dayNum: Number(key.split("-")[2]),
      isToday: key === todayKey,
      isFuture,
      isBeforeStart,
      isLogged: !isFuture && !isBeforeStart && loggedDays.has(key),
      // A disabled (future / pre-signup) cell is never shown as selected.
      isSelected: key === selectedKey && !isFuture && !isBeforeStart,
    });
  }
  return cells;
}
