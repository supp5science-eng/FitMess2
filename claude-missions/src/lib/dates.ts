/**
 * F028 / AS-046: shared Europe/Belgrade day-boundary utilities.
 *
 * Per `tech-decisions.md`'s convention ("All day/week boundaries in
 * Europe/Belgrade via the shared `src/lib/dates.ts` utilities -- never raw
 * `new Date()` day math"), every place in this codebase that needs to know
 * "what calendar day does this instant fall on" or "what are the UTC
 * instants that bound a given Belgrade calendar day" goes through this
 * file. Pure functions, no external timezone library (the platform's own
 * `Intl` API already ships full IANA tzdata in every supported Node/browser
 * runtime -- no `date-fns-tz`/`luxon`/`moment-timezone` dependency needed).
 *
 * Core technique (`getTimeZoneOffsetMs`): format a UTC instant's wall-clock
 * components IN a target IANA zone via `Intl.DateTimeFormat`, then
 * re-interpret those SAME components as if they were UTC. The delta between
 * that re-interpreted instant and the original instant is exactly the
 * zone's UTC offset (in ms, positive east of UTC) at that instant -- this
 * is the standard technique used by timezone libraries themselves, and it
 * transparently handles CET (UTC+1) vs CEST (UTC+2) without any hardcoded
 * DST rule.
 *
 * Europe/Belgrade always has a valid, unambiguous local midnight: the EU-wide
 * DST transitions happen at 01:00 UTC (02:00->03:00 CET->CEST in spring,
 * 03:00->02:00 CEST->CET in autumn), never crossing local midnight itself.
 * So "start of day" is always well-defined, even on a transition day (that
 * day is simply 23h or 25h long in UTC terms instead of 24h).
 */

const BELGRADE_TZ = "Europe/Belgrade";

export interface DayRange {
  /** Inclusive lower bound, ISO 8601 (UTC), suitable for a `.gte()` filter. */
  startIso: string;
  /** Exclusive upper bound, ISO 8601 (UTC), suitable for a `.lt()` filter. */
  endIsoExclusive: string;
}

/**
 * Returns the given IANA `timeZone`'s UTC offset (in milliseconds, positive
 * east of UTC) AT the instant `date`. E.g. for Europe/Belgrade this is
 * `+3_600_000` (CET, UTC+1) in winter and `+7_200_000` (CEST, UTC+2) in
 * summer.
 */
function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }

  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );

  return asIfUtc - date.getTime();
}

/**
 * Returns the Belgrade calendar day (`"YYYY-MM-DD"`) that `date` (any UTC
 * instant, e.g. a `logs.logged_at` timestamptz) falls on. This is the
 * canonical "assign a timestamptz to its Belgrade calendar day" function
 * (AS-046).
 */
export function toBelgradeCalendarDay(date: Date = new Date()): string {
  // `en-CA` formats numeric dates as `YYYY-MM-DD`, matching ISO ordering --
  // simpler and more direct than extracting formatToParts for this case.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BELGRADE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Returns the UTC instant corresponding to `00:00:00.000` local time in
 * Belgrade on the given `year`/`month` (1-12)/`day`. `month`/`day` may be
 * out of their normal 1-12 / 1-31 range (e.g. `day: 32`) -- `Date.UTC`'s
 * standard overflow normalization is relied on deliberately, so callers can
 * compute "the day after" by just passing `day + 1`.
 */
function belgradeMidnightUtc(year: number, month: number, day: number): Date {
  // First guess: treat the target Y-M-D midnight as if it were already UTC.
  const guess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  const offsetAtGuess = getTimeZoneOffsetMs(guess, BELGRADE_TZ);
  let instant = new Date(guess.getTime() - offsetAtGuess);

  // Re-check the offset AT the computed instant (not the guess) -- matters
  // only if the guess and the real instant straddle a DST transition, which
  // cannot actually happen for a local-midnight target in Europe/Belgrade
  // (transitions occur at 01:00/03:00 local, never at 00:00), but this
  // fixed-point re-check costs nothing and removes any doubt.
  const offsetAtInstant = getTimeZoneOffsetMs(instant, BELGRADE_TZ);
  if (offsetAtInstant !== offsetAtGuess) {
    instant = new Date(guess.getTime() - offsetAtInstant);
  }

  return instant;
}

/**
 * The UTC instant of the start (inclusive, `00:00:00.000` local) of the
 * Belgrade calendar day that `date` falls on.
 */
export function startOfBelgradeDay(date: Date = new Date()): Date {
  const [year, month, day] = toBelgradeCalendarDay(date)
    .split("-")
    .map(Number);
  return belgradeMidnightUtc(year!, month!, day!);
}

/**
 * The UTC instant of the start of the NEXT Belgrade calendar day after the
 * one `date` falls on -- i.e. the exclusive upper bound of `date`'s
 * Belgrade day.
 */
export function endOfBelgradeDayExclusive(date: Date = new Date()): Date {
  const [year, month, day] = toBelgradeCalendarDay(date)
    .split("-")
    .map(Number);
  // `day + 1` deliberately overflows into next month/year when needed --
  // `Date.UTC` (used inside `belgradeMidnightUtc`) normalizes that for us.
  return belgradeMidnightUtc(year!, month!, day! + 1);
}

/**
 * Returns the Belgrade "day range" (`{ startIso, endIsoExclusive }`, both
 * ISO 8601 UTC strings) that `date` falls within -- ready to drive a
 * `logged_at >= startIso AND logged_at < endIsoExclusive` query. This is
 * what `src/lib/home/today-range.ts`'s `getTodayRange` now delegates to.
 */
export function getBelgradeDayRange(date: Date = new Date()): DayRange {
  return {
    startIso: startOfBelgradeDay(date).toISOString(),
    endIsoExclusive: endOfBelgradeDayExclusive(date).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// F040/F041: week helpers. "The week is the unit of success" -- the weekly
// dashboard needs Monday-anchored week boundaries (Serbian/EU convention,
// week starts Monday) in the SAME Europe/Belgrade calendar frame as the day
// helpers above, never raw `new Date()` week math.
// ---------------------------------------------------------------------------

/**
 * 0-based weekday index of a Belgrade calendar day, Monday = 0 ... Sunday = 6
 * (EU/Serbian convention -- differs from JS's Sunday = 0). Computed purely
 * from the calendar day's Y-M-D so it is timezone-frame-independent (a given
 * calendar date always falls on the same weekday everywhere).
 */
export function belgradeWeekdayIndex(date: Date = new Date()): number {
  const [year, month, day] = toBelgradeCalendarDay(date).split("-").map(Number);
  // getUTCDay(): Sunday = 0 ... Saturday = 6. Shift so Monday = 0.
  const jsDay = new Date(Date.UTC(year!, month! - 1, day!)).getUTCDay();
  return (jsDay + 6) % 7;
}

/**
 * The `"YYYY-MM-DD"` Belgrade calendar day of the MONDAY that starts the week
 * `date` falls in.
 */
export function belgradeWeekStartDay(date: Date = new Date()): string {
  const [year, month, day] = toBelgradeCalendarDay(date).split("-").map(Number);
  const offset = belgradeWeekdayIndex(date);
  // `day - offset` may go non-positive (e.g. Monday is in the previous month);
  // Date.UTC normalizes the overflow, and en-CA re-formats to YYYY-MM-DD.
  const monday = new Date(Date.UTC(year!, month! - 1, day! - offset));
  return toBelgradeCalendarDay(monday);
}

/**
 * The 7 Belgrade calendar-day keys (`"YYYY-MM-DD"`, Monday..Sunday) of the
 * week `date` falls in. Handy for bucketing a week of logs into fixed
 * Mon..Sun slots (empty days included).
 */
export function belgradeWeekDayKeys(date: Date = new Date()): string[] {
  const [year, month, day] = belgradeWeekStartDay(date).split("-").map(Number);
  return Array.from({ length: 7 }, (_, i) =>
    toBelgradeCalendarDay(new Date(Date.UTC(year!, month! - 1, day! + i)))
  );
}

/**
 * The Belgrade "week range" (`{ startIso, endIsoExclusive }`, both ISO 8601
 * UTC strings) for the Monday..Sunday week `date` falls in -- ready to drive
 * a `logged_at >= startIso AND logged_at < endIsoExclusive` query over a full
 * week of logs. Start is Monday 00:00 Belgrade; end is the FOLLOWING Monday
 * 00:00 Belgrade (exclusive).
 */
export function getBelgradeWeekRange(date: Date = new Date()): DayRange {
  const [year, month, day] = belgradeWeekStartDay(date).split("-").map(Number);
  return {
    startIso: belgradeMidnightUtc(year!, month!, day!).toISOString(),
    endIsoExclusive: belgradeMidnightUtc(year!, month!, day! + 7).toISOString(),
  };
}
