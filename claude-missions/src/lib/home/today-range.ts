/**
 * F027 / AS-047, AS-048, AS-049, AS-050: "today" boundary helper for the
 * home screen's log query.
 *
 * F028 / AS-046: this now delegates to the shared, Europe/Belgrade-aware
 * `src/lib/dates.ts` (`getBelgradeDayRange`) per `tech-decisions.md`'s
 * convention ("All day/week boundaries in Europe/Belgrade via the shared
 * `src/lib/dates.ts` utilities -- never raw `new Date()` day math"). F027
 * deliberately shipped this helper with plain SERVER-local `Date` component
 * math and documented it as a swappable placeholder pending this feature --
 * every caller (`src/lib/home/today.ts`'s `getTodayData`, and by extension
 * `/danas`'s page) already only depends on the narrow `{ startIso,
 * endIsoExclusive }` return shape, so this is the only file that changed.
 */

import { getBelgradeDayRange, type DayRange } from "@/lib/dates";

export type { DayRange };

/**
 * Returns the start (inclusive) / end (exclusive) instants of "today" in
 * the BELGRADE calendar day that `now` falls within, as ISO strings ready
 * for a `logged_at >= startIso AND logged_at < endIsoExclusive` query.
 */
export function getTodayRange(now: Date = new Date()): DayRange {
  return getBelgradeDayRange(now);
}
