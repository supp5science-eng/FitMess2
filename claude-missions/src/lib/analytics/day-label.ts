/**
 * One Serbian long-form label for a calendar day, shared by every Analitika
 * chart: "Danas", "Juče", otherwise "Sreda, 22. jul".
 *
 * It exists because the charts became TAPPABLE (2026-07-25): tapping a bar or a
 * point shows that day's real numbers, and every one of those read-outs has to
 * name the day the same way -- five cards inventing five date formats is how a
 * screen stops feeling like one product.
 *
 * The label is computed SERVER-SIDE, inside the same pure function that builds
 * the day (`computeStepsWeek`, `computeWaterWeek`, ...), and travels down as
 * data. That is deliberate: deriving it in the component would mean calling
 * `new Date()` during render, and a card rendered just before midnight on the
 * server and just after on the client would hydrate with two different labels.
 */

import { toBelgradeCalendarDay } from "@/lib/dates";
import { belgradeDayLabel } from "@/lib/log/group";

/** `"2026-07-22"` → `"Sreda, 22. jul"` (or "Danas" / "Juče"). */
export function analyticsDayLabel(dayKey: string, now: Date): string {
  const todayKey = toBelgradeCalendarDay(now);
  const [year, month, day] = todayKey.split("-").map(Number);
  const yesterdayKey = toBelgradeCalendarDay(
    new Date(Date.UTC(year!, month! - 1, day! - 1))
  );
  // `belgradeDayLabel` is the meal-history header format ("sreda, 22. jul");
  // a read-out opens a line, so the weekday is capitalised here.
  const label = belgradeDayLabel(dayKey, todayKey, yesterdayKey);
  return label.charAt(0).toUpperCase() + label.slice(1);
}
