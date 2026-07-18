/**
 * F027 / AS-047, AS-048, AS-049, AS-050: "today" boundary helper for the
 * home screen's log query.
 *
 * DELIBERATELY NOT Europe/Belgrade-aware yet -- per the clarified spec's
 * scope note: "'Today' = for now use the user's local/day; F028 (next) will
 * formalize Europe/Belgrade day boundaries + the '+' add sheet, so keep the
 * day-query in a small helper F028 can swap." This is that helper. It uses
 * the SERVER's local wall-clock day (via plain `Date` component getters,
 * `now.getFullYear()/getMonth()/getDate()`), which is a deliberate,
 * temporary deviation from tech-decisions.md's "never raw `new Date()` day
 * math" convention -- the clarified spec explicitly defers correct
 * Europe/Belgrade day-boundary math to F028, this feature must not guess at
 * it.
 *
 * F028 should replace the body of `getTodayRange` (only this function --
 * every caller already only depends on this narrow `{ startIso,
 * endIsoExclusive }` return shape) with a real Europe/Belgrade-aware
 * midnight-to-midnight calculation, most likely wrapping it in
 * `src/lib/dates.ts` per tech-decisions.md's "shared `src/lib/dates.ts`
 * utilities" convention (that file does not exist yet -- this feature does
 * not create it, to avoid guessing at F028's full timezone-boundary
 * contract).
 */

export interface DayRange {
  /** Inclusive lower bound, ISO 8601 (UTC), suitable for a `.gte()` filter. */
  startIso: string;
  /** Exclusive upper bound, ISO 8601 (UTC), suitable for a `.lt()` filter. */
  endIsoExclusive: string;
}

/**
 * Returns the start (inclusive) / end (exclusive) instants of "today" in the
 * SERVER's local wall-clock day, as ISO strings ready for a
 * `logged_at >= startIso AND logged_at < endIsoExclusive` query.
 */
export function getTodayRange(now: Date = new Date()): DayRange {
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0
  );
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { startIso: start.toISOString(), endIsoExclusive: end.toISOString() };
}
