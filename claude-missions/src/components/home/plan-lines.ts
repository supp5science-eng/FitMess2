import type { AdaptivePlan } from "@/lib/home/adaptive";
import type { TFunction } from "@/lib/i18n/translate";

/**
 * The sentences that explain a moved plan, derived in ONE place.
 *
 * Two screens say this now -- the once-a-day `PlanIntro` moment and the
 * always-available `PlanNote` sheet -- and they must never word the same week
 * differently. The dangerous parts are not the layout but the rules:
 *
 *   * WHICH day gets named (the biggest deviation, and only a trusted one);
 *   * that "juče" needs a whole separate sentence rather than a swapped-in
 *     word, because it is an adverb and cannot stand where a weekday NAME
 *     stands ("četvrtak je bio 500 kcal veći" is Serbian, "juče je bio" is not);
 *   * that a named day REPLACES the generic sentence instead of stacking on it.
 *
 * Duplicating any of that across two components is how they drift apart. The
 * markup stays with each screen; only the words come from here.
 */

/** `"2026-01-06"` -> 0 = Monday .. 6 = Sunday. */
function weekdayIndexOf(dayKey: string): number {
  const utcDay = new Date(`${dayKey}T12:00:00.000Z`).getUTCDay();
  return (utcDay + 6) % 7;
}

/** The calendar day before `dayKey`. */
function previousDay(dayKey: string): string {
  const date = new Date(`${dayKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function formatPlanNumber(value: number): string {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export interface PlanLines {
  /** Why the plan moved. Never null: falls back to the generic sentence. */
  cause: string;
  /** The walking suggestion, or null when no activity is needed. */
  walk: string | null;
  /** What the change means for the rest of the week, or null on the last day. */
  forward: string | null;
  /** What this week cannot absorb, or null when it all fits. */
  spill: string | null;
  /** True when the NUMBER moved, as opposed to only the activity suggestion. */
  moved: boolean;
  /** True when the target went UP (only ever for gain/maintain goals). */
  lifted: boolean;
}

export function planLines(
  plan: AdaptivePlan,
  dayKey: string,
  t: TFunction
): PlanLines {
  const lifted = plan.liftedKcal > 0;
  const moved = plan.trimmedKcal > 0 || plan.liftedKcal > 0;

  const weekdayNames = t("home.adaptive.weekdays").split(" ");
  const dayName = (key: string) => weekdayNames[weekdayIndexOf(key)] ?? key;

  // ONE reason, not a list -- `causeDays` is already sorted by deviation.
  const cause = plan.causeDays[0] ?? null;
  const yesterdayKey = previousDay(dayKey);
  const causeKey = !cause
    ? null
    : cause.dayKey === yesterdayKey
      ? cause.deltaKcal > 0
        ? "home.adaptive.causeOverYesterday"
        : "home.adaptive.causeUnderYesterday"
      : cause.deltaKcal > 0
        ? "home.adaptive.causeOver"
        : "home.adaptive.causeUnder";

  let causeText =
    cause && causeKey
      ? t(causeKey, {
          day: dayName(cause.dayKey),
          kcal: formatPlanNumber(Math.abs(cause.deltaKcal)),
        })
      : lifted
        ? t("home.adaptive.lifted")
        : t("home.adaptive.lowered");

  if (plan.carryInKcal > 0) {
    causeText += ` ${t("home.adaptive.carry", {
      kcal: formatPlanNumber(plan.carryInKcal),
    })}`;
  }

  return {
    cause: causeText,
    walk:
      plan.trainingSuggestionKcal > 0
        ? t("home.planIntro.walk", { min: plan.trainingWalkMinutes })
        : null,
    forward:
      moved && plan.daysAfterToday > 0
        ? t("home.adaptive.forward", {
            days: plan.daysAfterToday,
            unit:
              plan.daysAfterToday === 1
                ? t("home.adaptive.day")
                : t("home.adaptive.days"),
            kcal: formatPlanNumber(plan.adaptiveDailyTarget),
            delta: `${lifted ? "+" : "−"}${formatPlanNumber(
              lifted ? plan.liftedKcal : plan.trimmedKcal
            )}`,
          })
        : null,
    spill:
      plan.spillToNextWeekKcal > 0
        ? t("home.adaptive.spill", {
            kcal: formatPlanNumber(plan.spillToNextWeekKcal),
          })
        : null,
    moved,
    lifted,
  };
}
