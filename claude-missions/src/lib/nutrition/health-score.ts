/**
 * "Ocena zdravosti" (2026-07-25): a 0..10 score for the QUALITY of what the user
 * has eaten today, shown under the four micronutrient cards on the home tab's
 * second page.
 *
 * Deterministic on purpose (the product owner's choice over an AI-generated
 * score): the same day always scores the same, the number never drifts between
 * refreshes, it costs nothing per view, and every point is explainable -- which
 * matters, because a score the user can't reason about is a score they stop
 * trusting. Pure and DB-free like the rest of `src/lib/nutrition`.
 *
 * ## Why DENSITY, not "how much of the daily target did you hit"
 *
 * Scoring raw daily amounts would mean the score is terrible every morning and
 * only recovers at dinner -- it would really be measuring "how much of your day
 * you've logged", not how well you ate, and it would nag exactly the user who is
 * doing fine. So every nutrient is compared as a DENSITY: amount per consumed
 * kcal, against the target's own density (target amount per target kcal).
 *
 * Eat 25% of your calories with 25% of your protein and fiber and you score
 * full marks at 10am, the same as you would at 10pm. The calorie ring already
 * owns "how much is left"; this score owns "what was in it".
 *
 * ## The five components (2 points each)
 *
 *   protein, fiber   -- GOALS: full marks at or above the target density.
 *   sugar, sodium,
 *   saturated fat    -- LIMITS: full marks comfortably under, sliding to zero
 *                       well past the ceiling.
 *
 * Components with no data are EXCLUDED and the total is rescaled, so a day of
 * entries whose sodium nobody knows is scored on what we do know instead of
 * being silently marked down for our own missing data. Below
 * `MIN_COVERAGE_FOR_SCORE` there isn't enough to be fair about, and the card
 * shows "N/A" rather than a confident wrong number.
 */

import {
  MICRO_SPECS,
  type MicroKey,
  type MicroTotal,
  type MicroTotals,
  type MicroTargets,
} from "@/lib/nutrition/micro";

/** Below this many consumed kcal there is nothing meaningful to score (an
 * untouched day, or a single glass of water logged as food). */
export const MIN_KCAL_FOR_SCORE = 100;

/** If we know the micros for less than half of the day's kcal, we say so
 * instead of scoring. Matches the honesty rule in `micro.ts`. */
export const MIN_COVERAGE_FOR_SCORE = 0.5;

const POINTS_PER_COMPONENT = 2;
const MAX_SCORE = 10;

// Limit-type scoring shape: at or below 60% of the allowed density you get full
// marks (comfortably clean), and points fade to zero at 150% (well past the
// ceiling). Sitting exactly ON the limit lands ~1.1/2 -- "fine, not a problem",
// which is the honest reading of a guideline ceiling.
const LIMIT_FULL_RATIO = 0.6;
const LIMIT_ZERO_RATIO = 1.5;

export type ScoreComponentKey = "protein" | MicroKey;

export interface ScoreComponent {
  key: ScoreComponentKey;
  labelSr: string;
  /** "goal" = reach it, "limit" = stay under it. */
  kind: "goal" | "limit";
  /** Consumed density / target density. `null` when this nutrient has no data. */
  ratio: number | null;
  /** 0..2, or `null` when excluded for lack of data. */
  points: number | null;
}

export interface HealthScore {
  /** 0..10 with one decimal, or `null` = "N/A" (not enough logged/known). */
  score: number | null;
  /** score / 10, clamped -- fills the card's bar. 0 when score is null. */
  fillFraction: number;
  /** Serbian band label ("Odlično", "Dobro", ...) or null alongside a null score. */
  labelSr: string | null;
  /** One calm Serbian sentence: what to do next, or why there's no score yet. */
  noteSr: string;
  /** Per-component breakdown, for the expandable detail rows. */
  components: ScoreComponent[];
}

export interface HealthScoreInput {
  /** Today's consumed kcal and protein (from `computeDayTotals`). */
  consumedKcal: number;
  consumedProteinG: number;
  /** Today's micronutrient totals + coverage (from `computeMicroTotals`). */
  micros: MicroTotals;
  /** The day's targets: the calorie budget, protein grams, and the four
   * micronutrient numbers (`microTargetsForKcal`). */
  targetKcal: number;
  targetProteinG: number;
  microTargets: MicroTargets;
}

/** Density = amount per kcal. Guards a zero/undefined denominator. */
function density(amount: number, kcal: number): number | null {
  if (!Number.isFinite(amount) || !Number.isFinite(kcal) || kcal <= 0) {
    return null;
  }
  return amount / kcal;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Full marks at/above the target density, linear down to zero at nothing. */
function goalPoints(ratio: number): number {
  return POINTS_PER_COMPONENT * clamp01(ratio);
}

/** Full marks comfortably under the ceiling, fading to zero well past it. */
function limitPoints(ratio: number): number {
  const span = LIMIT_ZERO_RATIO - LIMIT_FULL_RATIO;
  return POINTS_PER_COMPONENT * clamp01((LIMIT_ZERO_RATIO - ratio) / span);
}

function bandLabelSr(score: number): string {
  if (score >= 8.5) return "Odlično";
  if (score >= 7) return "Vrlo dobro";
  if (score >= 5.5) return "Dobro";
  if (score >= 4) return "Može bolje";
  return "Ima prostora";
}

/**
 * The Serbian one-liner under the score. Points at the single weakest component
 * -- the one thing worth changing -- rather than listing everything, and stays
 * calm and non-shaming (the same posture as the overshoot copy on the ring).
 */
function noteForWeakest(component: ScoreComponent | null): string {
  if (!component) {
    return "Nastavi tako — dan izgleda uravnoteženo.";
  }
  switch (component.key) {
    case "protein":
      return "Najviše bi pomoglo malo više proteina u ostatku dana.";
    case "fiber":
      return "Dodaj vlakna — povrće, voće sa korom, integralno.";
    case "sugar":
      return "Šećera je danas više nego obično; nije problem, samo znaj.";
    case "sodium":
      return "Slano je danas naglašeno — pij vodu i olakšaj sledeći obrok.";
    case "satFat":
      return "Zasićenih masti je danas više; sutra biraj mršavije izvore.";
    default:
      return "Nastavi tako — dan izgleda uravnoteženo.";
  }
}

/**
 * Computes today's 0..10 quality score. Never throws: missing data, a zero
 * target or an empty day all degrade to a `null` score with an honest Serbian
 * explanation, which is exactly what the card renders as "N/A".
 */
export function computeHealthScore(input: HealthScoreInput): HealthScore {
  const consumedKcal = Number.isFinite(input.consumedKcal)
    ? Math.max(0, input.consumedKcal)
    : 0;
  const targetKcal = Number.isFinite(input.targetKcal)
    ? Math.max(0, input.targetKcal)
    : 0;

  const components: ScoreComponent[] = [];

  // Protein: always available (every log row carries macros), scored as a goal.
  const proteinRatio = (() => {
    const consumedDensity = density(input.consumedProteinG, consumedKcal);
    const targetDensity = density(input.targetProteinG, targetKcal);
    if (consumedDensity === null || targetDensity === null || targetDensity <= 0) {
      return null;
    }
    return consumedDensity / targetDensity;
  })();
  components.push({
    key: "protein",
    labelSr: "Proteini",
    kind: "goal",
    ratio: proteinRatio,
    points: proteinRatio === null ? null : goalPoints(proteinRatio),
  });

  // The four micronutrients.
  const microKeys: MicroKey[] = ["fiber", "sugar", "sodium", "satFat"];
  for (const key of microKeys) {
    const spec = MICRO_SPECS[key];
    const total: MicroTotal = input.micros.totals[key];
    const targetAmount = input.microTargets[key];

    const ratio = (() => {
      if (!total.hasData || total.coveredKcal <= 0) return null;
      // Density is taken over the kcal this nutrient was actually MEASURED on
      // (`coveredKcal`), not the whole day -- otherwise a half-described day
      // looks artificially "clean" (low sugar per kcal) just because the
      // unknown half contributed kcal but no sugar.
      const consumedDensity = density(total.value, total.coveredKcal);
      const targetDensity = density(targetAmount, targetKcal);
      if (consumedDensity === null || targetDensity === null || targetDensity <= 0) {
        return null;
      }
      return consumedDensity / targetDensity;
    })();

    components.push({
      key,
      labelSr: spec.labelSr,
      kind: spec.kind,
      ratio,
      points:
        ratio === null
          ? null
          : spec.kind === "goal"
            ? goalPoints(ratio)
            : limitPoints(ratio),
    });
  }

  // Not enough logged to say anything.
  if (consumedKcal < MIN_KCAL_FOR_SCORE) {
    return {
      score: null,
      fillFraction: 0,
      labelSr: null,
      noteSr:
        "Unesi par obroka pa ćemo izračunati ocenu za danas — gleda koliko je hrana bila kvalitetna, ne koliko je bilo kalorija.",
      components,
    };
  }

  // We know too little about what was eaten to grade it.
  if (input.micros.coverage < MIN_COVERAGE_FOR_SCORE) {
    return {
      score: null,
      fillFraction: 0,
      labelSr: null,
      noteSr:
        "Za veći deo današnjih unosa nemamo podatke o vlaknima, šećeru i soli, pa ocenu ne prikazujemo.",
      components,
    };
  }

  const scored = components.filter(
    (component): component is ScoreComponent & { points: number } =>
      component.points !== null
  );
  if (scored.length === 0) {
    return {
      score: null,
      fillFraction: 0,
      labelSr: null,
      noteSr: "Još nemamo dovoljno podataka za ocenu.",
      components,
    };
  }

  // Rescale over the components we could actually score, so our own missing
  // data never costs the user points.
  const earned = scored.reduce((sum, component) => sum + component.points, 0);
  const available = scored.length * POINTS_PER_COMPONENT;
  const rawScore = (earned / available) * MAX_SCORE;
  const score = Math.round(rawScore * 10) / 10;

  // The weakest scored component -- but only worth mentioning if it actually
  // lost a meaningful share of its points.
  const weakest = scored.reduce<(ScoreComponent & { points: number }) | null>(
    (worst, component) =>
      worst === null || component.points < worst.points ? component : worst,
    null
  );
  const weakestIsNotable =
    weakest !== null && weakest.points < POINTS_PER_COMPONENT * 0.75;

  return {
    score,
    fillFraction: clamp01(score / MAX_SCORE),
    labelSr: bandLabelSr(score),
    noteSr: noteForWeakest(weakestIsNotable ? weakest : null),
    components,
  };
}
