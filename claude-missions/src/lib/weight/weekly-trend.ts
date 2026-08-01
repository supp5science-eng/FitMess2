/**
 * Nedeljno merenje (2026-08-01): what the SCALE says about the plan.
 *
 * Every calorie target this app has ever written is a PREDICTION. `bmr()` puts
 * a person's resting expenditure within ~10% (Frankenfield et al., J Am Diet
 * Assoc 2005), and then `tdee()` multiplies that by an activity factor the user
 * picked once, from a five-item list, about themselves -- the single largest
 * error term in the whole chain. The gap between `light` (1.375) and `moderate`
 * (1.55) is over 300 kcal a day for a typical adult. Nobody can feel that
 * difference, and nobody self-reports it accurately.
 *
 * There is exactly one instrument that measures the answer instead of guessing
 * it: body weight over time, read against what was eaten. Rearranging the
 * energy-balance identity the budget engine already uses for goal pacing
 * (`KCAL_PER_KG_BODY_MASS`, ~7700 kcal/kg -- Wishnofsky's rule) gives
 *
 *     TDEE = prosečan dnevni unos + (izgubljeni kg x 7700) / broj dana
 *
 * which is the "intake-balance" method: the same principle used to validate
 * self-reported intake against doubly-labelled water (Racette et al., Am J
 * Physiol 2012), and the basis of adaptive-TDEE coaching apps. It costs one
 * weekly weigh-in and needs no questionnaire, no wearable, and no assumption
 * about activity at all -- metabolic adaptation, NEAT, genetics and a desk job
 * are all already inside the number.
 *
 * FOUR LAWS constrain everything below. They exist because this math, applied
 * naively, is how a nutrition app starts harming people:
 *
 *  1. NEVER react to a single measurement. Body weight swings 1-2 kg on water,
 *     sodium and glycogen alone -- a woman weighing in premenstrually can gain
 *     2 kg of water while losing fat. Only a TREND across >= 2 (ideally >= 3)
 *     weekly weigh-ins may move anything, and the fit below smooths the points
 *     rather than reading endpoints.
 *  2. NEVER apply a correction automatically. This module only ever RETURNS a
 *     suggestion; a new `targets` row is written only after the user taps
 *     "Prihvati". A plan that changes underneath someone is a plan they stop
 *     trusting.
 *  3. NEVER blame the plan for a log we do not believe. If the intake side is
 *     not trustworthy (`day-trust.ts`), the answer is INSUFFICIENT_DATA --
 *     "we don't know what you ate", never "your plan doesn't work". Under-
 *     reporting is the norm, not the exception (20-30% in DLW validation --
 *     Livingstone & Black, J Nutr 2003), and a measured TDEE built on a
 *     half-empty log would read as a metabolism 500 kcal slower than reality
 *     and prescribe a cut nobody needs.
 *  4. EVERY suggestion obeys the existing safety caps in `budget/engine.ts`:
 *     the 25% max deficit, the 20% max surplus, and the sex-specific kcal
 *     floor. Measuring a slow metabolism is not a licence to starve someone;
 *     when the caps leave no room, the honest answer is activity, not less
 *     food.
 *
 * Pure and DB-free, like the rest of the app's money-math: the caller gathers
 * weigh-ins and per-day intake (already judged by `day-trust.ts`), this decides,
 * and the Serbian copy lives in the UI / AI layer.
 */

import {
  KCAL_FLOOR,
  KCAL_PER_KG_BODY_MASS,
  MAX_DEFICIT_PCT,
  MAX_SURPLUS_PCT,
} from "@/lib/budget/engine";
import { stepsPerKcal } from "@/lib/home/adaptive";
import type { GoalType, Sex } from "@/lib/types/db";

// ---------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------

/**
 * Weekly weight change each goal is AIMING for, as a fraction of body weight
 * per week, expressed as PROGRESS (positive = the scale moving the way the goal
 * wants it to). Body-weight-relative rather than absolute kg because 0.5 kg a
 * week is a sane cut at 100 kg and a brutal one at 55 kg.
 *
 *  - `lose`: 0.5-1.0%/week is the standard clinical fat-loss window; faster
 *    costs lean mass (Garthe et al., Int J Sport Nutr Exerc Metab 2011).
 *  - `tone`: recomposition -- slower still, because the point is to hold muscle
 *    while fat comes off.
 *  - `maintain`: a symmetric dead-band; drifting either way by more than a
 *    quarter percent a week is drift, not noise.
 *  - `gain`: lean tissue accrues at roughly 0.25-0.5%/week; above that the
 *    surplus is mostly fat.
 */
export const EXPECTED_PROGRESS_PCT: Record<
  GoalType,
  { min: number; max: number }
> = {
  lose: { min: 0.005, max: 0.01 },
  tone: { min: 0.0025, max: 0.0075 },
  maintain: { min: -0.0025, max: 0.0025 },
  gain: { min: 0.0025, max: 0.005 },
};

/** Goal used when the target row has none (older rows). */
const FALLBACK_GOAL: GoalType = "maintain";

/**
 * Below this weekly movement (as a fraction of body weight) the scale is
 * standing still. 0.1%/week is ~90 g at 90 kg -- comfortably inside day-to-day
 * water noise, so calling it "no movement" over two weeks is safe.
 */
export const STALL_PCT_PER_WEEK = 0.001;

/** A stall is only a stall once it has had two weeks to show itself (Law 1). */
export const STALL_MIN_DAYS = 13;

/** Fewest weigh-ins that may move anything at all (Law 1). */
export const MIN_WEIGH_INS = 2;

/** Weigh-ins from which the trend is considered solid rather than provisional. */
export const GOOD_CONFIDENCE_WEIGH_INS = 3;

/**
 * Shortest span two weigh-ins may cover and still be read as a weekly trend.
 * Five days rather than seven so a user who weighs in on Sunday and then again
 * the following Friday is not told to come back later.
 */
export const MIN_SPAN_DAYS = 5;

/** A segment of days with fewer trusted days than this is not usable intake. */
export const MIN_TRUSTED_DAY_RATIO = 0.5;

/** Smallest correction worth making -- below this it is noise dressed as advice. */
export const MIN_CORRECTION_KCAL = 150;

/** Largest single-step correction. One weigh-in never moves a plan more than
 * this; if the plan really is 500 kcal wrong, two weeks fix it, and the second
 * week gets to confirm the first. */
export const MAX_CORRECTION_KCAL = 250;

/** Never suggest more than this many extra steps as the food-free alternative
 * (~50 minutes of brisk walking on top of the day, mirroring the ceiling the
 * adaptive plan already applies to its activity hint). */
export const MAX_EXTRA_STEPS = 5000;

// ---------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------

export interface WeighInPoint {
  /** Belgrade calendar day, `"YYYY-MM-DD"`. */
  day: string;
  weightKg: number;
}

/** One day's intake, already judged by `day-trust.ts`. */
export interface TrustedDayIntake {
  /** Belgrade calendar day, `"YYYY-MM-DD"`. */
  dayKey: string;
  kcal: number;
  /** `DayVerdict.counts` -- false for an empty or implausibly small log. */
  counts: boolean;
}

export type TrendStatus =
  /** Moving at the pace the goal wants. Nothing to do. */
  | "ON_TRACK"
  /** Progressing slower than the goal's band (or moving the wrong way). */
  | "TOO_SLOW"
  /** Not moving at all, for two weeks or more (`lose`/`tone` only). */
  | "STALLED"
  /** Progressing faster than the goal's band -- on a cut, a lean-mass risk. */
  | "TOO_FAST"
  /** We cannot say. Never a verdict about the plan (Law 3). */
  | "INSUFFICIENT_DATA";

export type InsufficientReason =
  /** Fewer than `MIN_WEIGH_INS` weigh-ins on file. */
  | "few_weigh_ins"
  /** Two weigh-ins, but too close together to read as a weekly trend. */
  | "span_too_short"
  /** The weight side is fine; the FOOD log is not complete enough to trust. */
  | "untrusted_intake";

/** Which way the food target has to move. */
export type CorrectionDirection = "cut" | "add";

/** Why a suggestion came out smaller than the arithmetic wanted. */
export type SuggestionCap =
  | "floor_kcal"
  | "max_deficit_25_percent"
  | "max_surplus_20_percent";

export interface PlanSuggestion {
  direction: CorrectionDirection;
  /** Signed kcal change to the current daily target (negative = cut).
   * Zero when a safety cap left no room -- then `extraSteps` is the only offer. */
  deltaKcal: number;
  /** The daily target the user would be accepting. */
  newDailyKcal: number;
  /** Same energy shift expressed as walking, offered instead of cutting food.
   * Only ever set for a `cut`: you cannot eat more by walking less. */
  extraSteps: number | null;
  /** True when a cap from `budget/engine.ts` shortened the delta (Law 4). */
  capped: boolean;
  capReasons: SuggestionCap[];
}

export interface ExpectedBand {
  /** Signed weekly change on the SCALE, kg (min <= max, negative = losing). */
  minKgPerWeek: number;
  maxKgPerWeek: number;
  /** The same band as a fraction of body weight (for copy: "0.5-1%"). */
  minPct: number;
  maxPct: number;
}

export interface WeeklyTrendResult {
  status: TrendStatus;
  /** Set only when `status` is INSUFFICIENT_DATA. */
  reason: InsufficientReason | null;
  /** How much the trend is worth: `low` on two weigh-ins, `good` from three. */
  confidence: "low" | "good" | null;
  weighInCount: number;
  /** Days between the first and last weigh-in. */
  spanDays: number;
  /** Newest weigh-in, the number the card shows. */
  currentWeightKg: number | null;
  /** Fitted weekly change on the scale, kg (negative = losing). */
  trendKgPerWeek: number | null;
  /** The same, as a fraction of current body weight. */
  trendPctPerWeek: number | null;
  expected: ExpectedBand | null;
  /** TDEE measured from intake + weight change. Null when intake isn't trusted. */
  measuredTdeeKcal: number | null;
  /** TDEE the plan was written against (Mifflin x activity), for the "we
   * predicted X, you actually burn Y" line. Passed in by the caller. */
  plannedTdeeKcal: number | null;
  /** Mean daily kcal over the trusted days used for the measurement. */
  avgDailyKcal: number | null;
  /** Trusted / total days in the window the measurement used. */
  trustedDays: number;
  measuredDays: number;
  suggestion: PlanSuggestion | null;
}

export interface WeeklyTrendInput {
  /** Recent weekly weigh-ins, any order. Only the last 4 matter. */
  weighIns: readonly WeighInPoint[];
  /** Per-day intake covering the weigh-in span, already trust-judged. */
  days: readonly TrustedDayIntake[];
  goal: GoalType | null;
  sex: Sex;
  /** `targets.daily_kcal` currently in force. */
  currentDailyKcal: number;
  /** What `bmr()` x activity predicted, if the caller could compute it. */
  plannedTdeeKcal?: number | null;
}

// ---------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------

/** Whole days between two `"YYYY-MM-DD"` keys (b - a). */
export function daysBetween(a: string, b: string): number {
  const start = Date.parse(`${a}T00:00:00.000Z`);
  const end = Date.parse(`${b}T00:00:00.000Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.round((end - start) / 86_400_000);
}

/** `"YYYY-MM-DD"` shifted by `delta` days. */
function shiftDay(day: string, delta: number): string {
  const [year, month, date] = day.split("-").map(Number);
  const shifted = new Date(Date.UTC(year!, month! - 1, date! + delta));
  return shifted.toISOString().slice(0, 10);
}

/** kg values are shown to two decimals -- a weekly rate of "-0.43 kg" is a real
 * distinction, "-0.4" vs "-0.5" is not. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Daily kcal targets are shown and stored whole; round to 10 so an accepted
 * plan reads like a decision ("2.400") rather than a computation ("2.397"). */
function roundTo10(value: number): number {
  return Math.round(value / 10) * 10;
}

function roundTo500(value: number): number {
  return Math.round(value / 500) * 500;
}

/** Round to 10 AWAY from the unsafe side, so a rounded bound can never land a
 * few kcal inside the very cap it exists to enforce. */
function ceilTo10(value: number): number {
  return Math.ceil(value / 10) * 10;
}

function floorTo10(value: number): number {
  return Math.floor(value / 10) * 10;
}

/**
 * Least-squares slope of weight against day index, in kg/day.
 *
 * A fit rather than "last minus first" precisely because of Law 1: with three
 * or four points, one water-heavy morning at either end would otherwise set the
 * whole verdict. With two points the fit degenerates to the endpoint difference,
 * which is exactly right -- and why two points only ever earn `low` confidence.
 */
export function fitSlopeKgPerDay(points: readonly { x: number; y: number }[]): number {
  const n = points.length;
  if (n < 2) return 0;
  const meanX = points.reduce((sum, p) => sum + p.x, 0) / n;
  const meanY = points.reduce((sum, p) => sum + p.y, 0) / n;
  let num = 0;
  let den = 0;
  for (const point of points) {
    num += (point.x - meanX) * (point.y - meanY);
    den += (point.x - meanX) ** 2;
  }
  if (den === 0) return 0;
  return num / den;
}

/** The fitted line's value at day index `x`. */
export function fitAt(points: readonly { x: number; y: number }[], x: number): number {
  const n = points.length;
  if (n === 0) return 0;
  const meanX = points.reduce((sum, p) => sum + p.x, 0) / n;
  const meanY = points.reduce((sum, p) => sum + p.y, 0) / n;
  return meanY + fitSlopeKgPerDay(points) * (x - meanX);
}

function emptyResult(
  reason: InsufficientReason,
  partial: Partial<WeeklyTrendResult> = {}
): WeeklyTrendResult {
  return {
    status: "INSUFFICIENT_DATA",
    reason,
    confidence: null,
    weighInCount: 0,
    spanDays: 0,
    currentWeightKg: null,
    trendKgPerWeek: null,
    trendPctPerWeek: null,
    expected: null,
    measuredTdeeKcal: null,
    plannedTdeeKcal: null,
    avgDailyKcal: null,
    trustedDays: 0,
    measuredDays: 0,
    suggestion: null,
    ...partial,
  };
}

// ---------------------------------------------------------------------
// The measurement
// ---------------------------------------------------------------------

interface Measurement {
  tdeeKcal: number;
  avgDailyKcal: number;
  trustedDays: number;
  measuredDays: number;
}

/**
 * Measured TDEE over the most recent RUN of segments whose food log we believe.
 *
 * Segments are the gaps between consecutive weigh-ins. A morning weigh-in
 * reflects the food of the days BEFORE it, so the segment ending at weigh-in
 * `b` covers the days `[a, b-1]` -- the day of the earlier weigh-in through the
 * day before the later one.
 *
 * We walk from the newest segment backwards and stop at the first one whose
 * trusted-day ratio falls under `MIN_TRUSTED_DAY_RATIO`. That keeps the window
 * contiguous (energy balance over a span with a hole in it is not energy
 * balance) and prefers recent weeks, which is what a changing metabolism makes
 * relevant. Untrusted days INSIDE an accepted segment are imputed at the
 * trusted mean rather than counted at their logged value -- the same "absence
 * of data is not data" posture as `day-trust.ts`.
 */
function measureTdee(
  weighIns: readonly WeighInPoint[],
  days: readonly TrustedDayIntake[]
): Measurement | null {
  if (weighIns.length < 2) return null;

  const kcalByDay = new Map<string, TrustedDayIntake>();
  for (const day of days) kcalByDay.set(day.dayKey, day);

  let firstIndex = weighIns.length - 1;
  let trustedDays = 0;
  let trustedKcal = 0;
  let totalDays = 0;

  for (let i = weighIns.length - 1; i >= 1; i -= 1) {
    const from = weighIns[i - 1]!;
    const to = weighIns[i]!;
    const segmentDays = daysBetween(from.day, to.day);
    if (segmentDays <= 0) continue;

    let segTrusted = 0;
    let segKcal = 0;
    for (let d = 0; d < segmentDays; d += 1) {
      const entry = kcalByDay.get(shiftDay(from.day, d));
      if (entry?.counts) {
        segTrusted += 1;
        segKcal += entry.kcal;
      }
    }

    if (segTrusted / segmentDays < MIN_TRUSTED_DAY_RATIO) break;

    trustedDays += segTrusted;
    trustedKcal += segKcal;
    totalDays += segmentDays;
    firstIndex = i - 1;
  }

  if (totalDays <= 0 || trustedDays === 0) return null;

  const span = weighIns.slice(firstIndex);
  if (span.length < 2) return null;

  // Fit over the accepted span, then read the line's endpoints: the same
  // smoothing the trend uses, so the measurement is not hostage to one salty
  // dinner the night before a weigh-in.
  const base = span[0]!.day;
  const points = span.map((point) => ({
    x: daysBetween(base, point.day),
    y: point.weightKg,
  }));
  const startKg = fitAt(points, points[0]!.x);
  const endKg = fitAt(points, points[points.length - 1]!.x);

  const avgDailyKcal = trustedKcal / trustedDays;
  const tdeeKcal =
    avgDailyKcal + ((startKg - endKg) * KCAL_PER_KG_BODY_MASS) / totalDays;

  return {
    tdeeKcal: Math.round(tdeeKcal),
    avgDailyKcal: Math.round(avgDailyKcal),
    trustedDays,
    measuredDays: totalDays,
  };
}

// ---------------------------------------------------------------------
// The suggestion
// ---------------------------------------------------------------------

/**
 * Turns "you are off the pace" into a concrete, capped daily target.
 *
 * The size comes from the measurement, not from a fixed step: the ideal target
 * is the MEASURED TDEE offset by the energy the goal's mid-band pace needs, and
 * the delta is the distance from there to today's target -- then clamped to
 * `MIN_CORRECTION_KCAL..MAX_CORRECTION_KCAL` so no single week can swing a plan
 * wildly, and finally clamped again by Law 4's safety caps.
 */
function buildSuggestion({
  direction,
  goal,
  currentWeightKg,
  currentDailyKcal,
  measuredTdeeKcal,
  sex,
}: {
  direction: CorrectionDirection;
  goal: GoalType;
  currentWeightKg: number;
  currentDailyKcal: number;
  measuredTdeeKcal: number;
  sex: Sex;
}): PlanSuggestion | null {
  const band = EXPECTED_PROGRESS_PCT[goal];
  const midProgressPct = (band.min + band.max) / 2;
  // Progress is "movement the goal wants"; on the scale that is a GAIN for
  // `gain` and a LOSS for everything else.
  const desiredKgPerWeek =
    (goal === "gain" ? midProgressPct : -midProgressPct) * currentWeightKg;
  const desiredDailyBalance = (desiredKgPerWeek * KCAL_PER_KG_BODY_MASS) / 7;
  const idealDailyKcal = measuredTdeeKcal + desiredDailyBalance;

  const rawDelta = idealDailyKcal - currentDailyKcal;
  const sign = direction === "cut" ? -1 : 1;
  // The arithmetic must agree with the status about which way to move; when it
  // does not (a band edge case), fall back to the smallest meaningful step.
  const magnitude =
    Math.sign(rawDelta) === sign
      ? Math.min(Math.max(Math.abs(rawDelta), MIN_CORRECTION_KCAL), MAX_CORRECTION_KCAL)
      : MIN_CORRECTION_KCAL;

  const wanted = roundTo10(currentDailyKcal + sign * magnitude);

  // Law 4: the caps from the budget engine, applied against the TDEE we just
  // MEASURED rather than the one we once predicted.
  //
  // A cap may only ever SHORTEN this step, never lengthen it. That distinction
  // matters: someone losing fast is, by definition, eating well under their
  // measured expenditure, so the 25% rule would "want" to hand them +600 kcal
  // in one go. A plan that jumps like that is not a plan. The cap stops the
  // target moving further into unsafe ground; walking it back out stays a
  // 150-250 kcal-per-week affair, and next week's weigh-in gets to confirm it.
  //
  // Nor may a cap move the target the WRONG way: a user already below the
  // floor (older plan, edited profile) must never be handed a cut, but must not
  // be silently force-fed either -- they get a zero-kcal step and, on a cut, the
  // activity alternative instead.
  const capReasons: SuggestionCap[] = [];
  const floor = KCAL_FLOOR[sex] ?? KCAL_FLOOR.male;
  let capped = wanted;

  if (sign < 0) {
    const deficitFloor = ceilTo10(measuredTdeeKcal * (1 - MAX_DEFICIT_PCT));
    const lowerBound = Math.max(floor, deficitFloor);
    if (wanted < lowerBound) {
      capped = Math.min(currentDailyKcal, lowerBound);
      if (deficitFloor >= floor) capReasons.push("max_deficit_25_percent");
      if (floor >= deficitFloor) capReasons.push("floor_kcal");
    }
  } else {
    const upperBound = floorTo10(measuredTdeeKcal * (1 + MAX_SURPLUS_PCT));
    if (wanted > upperBound) {
      capped = Math.max(currentDailyKcal, upperBound);
      capReasons.push("max_surplus_20_percent");
    }
  }

  const cappedDelta =
    sign < 0
      ? Math.min(0, capped - currentDailyKcal)
      : Math.max(0, capped - currentDailyKcal);
  const newDailyKcal = currentDailyKcal + cappedDelta;

  // The food-free alternative. Only for a cut: walking cannot make you eat
  // more. Sized from the delta the caps REFUSED to give us when there is one,
  // otherwise from the delta itself -- so "we can't cut further, walk instead"
  // is a real answer rather than a smaller version of the same advice.
  const stepsKcal =
    direction === "cut"
      ? Math.max(Math.abs(magnitude), Math.abs(cappedDelta))
      : 0;
  // Scaled by the weight the SCALE just reported, not the one the profile was
  // set up with -- this is the one place in the app that has a measured number
  // rather than a remembered one, and the walk costs what it costs for the
  // body doing it.
  const extraSteps =
    direction === "cut" && stepsKcal > 0
      ? Math.min(
          MAX_EXTRA_STEPS,
          roundTo500(stepsKcal * stepsPerKcal(currentWeightKg))
        )
      : null;

  if (cappedDelta === 0 && extraSteps === null) return null;

  return {
    direction,
    deltaKcal: cappedDelta,
    newDailyKcal,
    extraSteps,
    capped: capReasons.length > 0,
    capReasons,
  };
}

// ---------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------

/**
 * Reads the scale against the plan and returns a status plus, when warranted, a
 * correction to OFFER (never to apply -- Law 2).
 */
export function computeWeeklyTrend(input: WeeklyTrendInput): WeeklyTrendResult {
  const goal = input.goal ?? FALLBACK_GOAL;
  const plannedTdeeKcal = input.plannedTdeeKcal ?? null;

  // Newest last, one point per day (a same-day duplicate would break the fit;
  // the DB's unique (user_id, day) makes this belt-and-braces).
  const byDay = new Map<string, WeighInPoint>();
  for (const point of input.weighIns) {
    if (!Number.isFinite(point.weightKg) || point.weightKg <= 0) continue;
    byDay.set(point.day, point);
  }
  const weighIns = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));

  if (weighIns.length < MIN_WEIGH_INS) {
    return emptyResult("few_weigh_ins", {
      weighInCount: weighIns.length,
      currentWeightKg: weighIns[weighIns.length - 1]?.weightKg ?? null,
      plannedTdeeKcal,
    });
  }

  const first = weighIns[0]!;
  const last = weighIns[weighIns.length - 1]!;
  const spanDays = daysBetween(first.day, last.day);
  const currentWeightKg = last.weightKg;

  if (spanDays < MIN_SPAN_DAYS) {
    return emptyResult("span_too_short", {
      weighInCount: weighIns.length,
      spanDays,
      currentWeightKg,
      plannedTdeeKcal,
    });
  }

  // The trend uses EVERY weigh-in: it describes the scale, which needs no
  // opinion about the food log.
  const points = weighIns.map((point) => ({
    x: daysBetween(first.day, point.day),
    y: point.weightKg,
  }));
  const trendKgPerWeek = round2(fitSlopeKgPerDay(points) * 7);
  const trendPctPerWeek =
    currentWeightKg > 0 ? trendKgPerWeek / currentWeightKg : 0;

  const band = EXPECTED_PROGRESS_PCT[goal];
  const expected: ExpectedBand = {
    minKgPerWeek: round2(
      (goal === "gain" ? band.min : -band.max) * currentWeightKg
    ),
    maxKgPerWeek: round2(
      (goal === "gain" ? band.max : -band.min) * currentWeightKg
    ),
    minPct: goal === "gain" ? band.min : -band.max,
    maxPct: goal === "gain" ? band.max : -band.min,
  };

  const confidence =
    weighIns.length >= GOOD_CONFIDENCE_WEIGH_INS ? "good" : "low";

  const shared = {
    weighInCount: weighIns.length,
    spanDays,
    currentWeightKg,
    trendKgPerWeek,
    trendPctPerWeek,
    expected,
    plannedTdeeKcal,
    confidence,
  } as const;

  // Law 3: the weight side is fine, but without a believable food log there is
  // no measurement -- and therefore nothing to say about the plan.
  const measurement = measureTdee(weighIns, input.days);
  if (!measurement) {
    return emptyResult("untrusted_intake", { ...shared });
  }

  // Progress = movement in the direction this goal wants.
  const progressPct =
    goal === "gain" ? trendPctPerWeek : -trendPctPerWeek;

  const stalled =
    (goal === "lose" || goal === "tone") &&
    spanDays >= STALL_MIN_DAYS &&
    Math.abs(trendPctPerWeek) < STALL_PCT_PER_WEEK;

  let status: TrendStatus;
  if (stalled) status = "STALLED";
  else if (progressPct < band.min) status = "TOO_SLOW";
  else if (progressPct > band.max) status = "TOO_FAST";
  else status = "ON_TRACK";

  // TOO_SLOW / STALLED: push harder in the goal's direction -- less food on a
  // cut, more food on a bulk. TOO_FAST: ease off, the other way round.
  const direction: CorrectionDirection | null =
    status === "ON_TRACK"
      ? null
      : status === "TOO_FAST"
        ? goal === "gain"
          ? "cut"
          : "add"
        : goal === "gain"
          ? "add"
          : "cut";

  const suggestion =
    direction === null
      ? null
      : buildSuggestion({
          direction,
          goal,
          currentWeightKg,
          currentDailyKcal: input.currentDailyKcal,
          measuredTdeeKcal: measurement.tdeeKcal,
          sex: input.sex,
        });

  return {
    ...shared,
    status,
    reason: null,
    measuredTdeeKcal: measurement.tdeeKcal,
    avgDailyKcal: measurement.avgDailyKcal,
    trustedDays: measurement.trustedDays,
    measuredDays: measurement.measuredDays,
    suggestion,
  };
}
