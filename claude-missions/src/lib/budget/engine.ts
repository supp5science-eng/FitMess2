/**
 * F014: deterministic budget engine.
 *
 * Pure, side-effect-free arithmetic for BMR, TDEE, daily/weekly calorie
 * targets, macro splits, and safe-bound goal adjustment. No I/O, no
 * randomness, no wall-clock reads -- every function here is referentially
 * transparent so callers (F015/F016 onboarding, F045 weekly recalculation,
 * F053 redistribution) can rely on identical output for identical input,
 * and so this module can be exhaustively unit-tested against hand-computed
 * reference values (AS-021..AS-026, AS-030).
 *
 * Per tech-decisions.md "Money-math rule": budget/TDEE numbers are computed
 * here in deterministic code. The AI agent (F057+) never performs this
 * arithmetic -- it only phrases the results in Serbian (AS-086 principle).
 *
 * Source formula: Mifflin MD, St Jeor ST, Hill LA, Scott BJ, Daugherty SA,
 * Koh YO. "A new predictive equation for resting energy expenditure in
 * healthy individuals." Am J Clin Nutr. 1990;51(2):241-247.
 *   men:   BMR = 10*weight(kg) + 6.25*height(cm) - 5*age(y) + 5
 *   women: BMR = 10*weight(kg) + 6.25*height(cm) - 5*age(y) - 161
 *
 * Activity-level tier names match `public.profiles.activity_level`
 * (supabase/migrations/0001_profiles.sql) via the shared `ActivityLevel`
 * type in src/lib/types/db.ts -- do not diverge from that enum.
 */

import type { ActivityLevel, GoalType, Sex } from "@/lib/types/db";

export type { ActivityLevel, GoalType, Sex };

// ---------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------

/**
 * Physiologically plausible input ranges. Callers upstream (onboarding
 * form validation) are expected to reject nonsense before it reaches this
 * module, but per the clarified spec ("never throw on expected edges"),
 * out-of-range or zero/negative inputs are clamped into these bounds
 * rather than throwing -- see the empty/zero-state tests in
 * engine.test.ts for the exact clamped output.
 */
export const MIN_WEIGHT_KG = 30;
export const MAX_WEIGHT_KG = 300;
export const MIN_HEIGHT_CM = 100;
export const MAX_HEIGHT_CM = 250;
export const MIN_AGE_YEARS = 13;
export const MAX_AGE_YEARS = 100;

/** Standard Mifflin-St Jeor activity multipliers (AS-022). */
export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/** Safe daily-kcal floors (AS-023). */
export const KCAL_FLOOR: Record<Sex, number> = {
  male: 1400,
  female: 1200,
};

/** No caller may ever push the deficit below TDEE by more than this (AS-024). */
export const MAX_DEFICIT_PCT = 0.25;

/** Symmetric cap for a weight-gain goal: never eat more than 20% over TDEE
 * (a lean-bulk pace; anything faster is mostly fat gain). */
export const MAX_SURPLUS_PCT = 0.2;

/**
 * Default deficit applied by `dailyTarget` when a caller doesn't supply an
 * explicit desired deficit -- a moderate, commonly-recommended 20% cut,
 * comfortably inside the 25% safety cap. Callers that derive a deficit
 * from an explicit goal (target weight + timeframe) should use
 * `planGoalAdjustment` instead, which computes the *implied* deficit from
 * the goal and clamps it to the same caps.
 */
export const DEFAULT_DEFICIT_PCT = 0.2;

/**
 * Mild deficit applied to the `tone` ("zategni se") goal. Toning is a body
 * recomposition intent -- shed a little fat and reveal muscle while holding
 * roughly the same weight -- so it eats slightly *below* maintenance rather
 * than at TDEE. A gentle 10% cut: enough to lean out over time without the
 * hunger/adherence cost of a full fat-loss deficit. Still clamped to the
 * sex-specific kcal floor like every other deficit.
 */
export const TONE_DEFICIT_PCT = 0.1;

/** Default protein target, within the clarified 1.8-2.2 g/kg range (AS-025). */
export const PROTEIN_G_PER_KG = 2.0;

/**
 * Last-resort protein floor. For a heavy person on a max deficit, protein at
 * the 2.0 g/kg default plus fat at its 0.6 g/kg floor can exceed the whole
 * kcal budget (carbs would go negative). Rather than return an impossible
 * split, `macroTargets` walks protein down toward this floor (still a solid,
 * muscle-sparing 1.6 g/kg) to make the numbers fit. See engine.test.ts.
 */
export const PROTEIN_G_PER_KG_MIN = 1.6;

/** Default fat target -- comfortably above the 0.6 g/kg safety floor. */
export const FAT_G_PER_KG_DEFAULT = 0.8;

/** Minimum fat target; never clamped below this even under a tight deficit (AS-025). */
export const FAT_G_PER_KG_MIN = 0.6;

/**
 * Approximate energy density of 1kg of body-mass change, used only to turn
 * a target-weight + timeframe goal into an implied daily deficit for
 * `planGoalAdjustment`. Widely-used clinical rule of thumb (~3500 kcal per
 * pound, i.e. ~7700 kcal/kg -- Wishnofsky's rule); not exact physiology,
 * but standard for this kind of goal-pacing estimate.
 */
export const KCAL_PER_KG_BODY_MASS = 7700;

// ---------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------

function clampNumber(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

/** Rounding rule (clarified #13): kcal values are always whole numbers. */
function roundKcal(value: number): number {
  return Math.round(value);
}

/** Rounding rule (clarified #13): kg/gram values keep one decimal place. */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

// ---------------------------------------------------------------------
// BMR / TDEE
// ---------------------------------------------------------------------

/**
 * Basal metabolic rate via the Mifflin-St Jeor equation (AS-021).
 * Inputs are clamped into physiologically plausible ranges rather than
 * throwing (see the MIN_ and MAX_ constants above); result is a whole kcal value.
 */
export function bmr(
  sex: Sex,
  weightKg: number,
  heightCm: number,
  ageYears: number
): number {
  const w = clampNumber(weightKg, MIN_WEIGHT_KG, MAX_WEIGHT_KG);
  const h = clampNumber(heightCm, MIN_HEIGHT_CM, MAX_HEIGHT_CM);
  const a = clampNumber(ageYears, MIN_AGE_YEARS, MAX_AGE_YEARS);

  const base = 10 * w + 6.25 * h - 5 * a;
  const value = sex === "male" ? base + 5 : base - 161;

  return roundKcal(value);
}

/**
 * Total daily energy expenditure: BMR times the activity-level multiplier
 * (AS-022). An unrecognized activity level (e.g. bad data from the DB)
 * falls back to the most conservative (lowest) multiplier, `sedentary`,
 * rather than throwing.
 */
export function tdee(bmrKcal: number, activityLevel: ActivityLevel): number {
  const multiplier =
    ACTIVITY_MULTIPLIERS[activityLevel] ?? ACTIVITY_MULTIPLIERS.sedentary;
  const b = Math.max(0, bmrKcal);

  return roundKcal(b * multiplier);
}

// ---------------------------------------------------------------------
// Daily target
// ---------------------------------------------------------------------

/**
 * Applies a fat-loss deficit to TDEE, clamped to the two safety rules:
 *  - the deficit itself never exceeds MAX_DEFICIT_PCT (25%) below TDEE (AS-024)
 *  - the resulting daily kcal never drops below the sex-specific floor
 *    (1400 men / 1200 women) (AS-023) -- this floor wins even if it means
 *    the effective deficit ends up smaller than requested, or (for a very
 *    low TDEE) the "target" ends up at or above TDEE.
 *
 * `desiredDeficitPct` defaults to a moderate 20% cut when the caller
 * doesn't supply one; a negative value (implying a surplus) clamps to 0
 * (maintenance) since this function's purpose is fat-loss pacing, not bulk
 * planning.
 */
export function dailyTarget(
  tdeeKcal: number,
  sex: Sex,
  desiredDeficitPct: number = DEFAULT_DEFICIT_PCT
): number {
  const safeTdee = Math.max(0, tdeeKcal);
  const deficitPct = clampNumber(desiredDeficitPct, 0, MAX_DEFICIT_PCT);
  const floor = KCAL_FLOOR[sex] ?? KCAL_FLOOR.male;

  const raw = roundKcal(safeTdee * (1 - deficitPct));

  // The floor lifts the target up, but it must never lift it *above* TDEE --
  // otherwise a small/older/sedentary person whose TDEE is below the floor
  // would be handed a surplus while trying to lose. Cap at TDEE (maintenance
  // via food); the remaining deficit has to come from activity.
  return Math.min(Math.max(raw, floor), safeTdee);
}

// ---------------------------------------------------------------------
// Macro targets
// ---------------------------------------------------------------------

export interface MacroTargets {
  proteinG: number;
  fatG: number;
  carbsG: number;
  /**
   * True when the deficit was tight enough that protein+fat at their
   * default targets would have exceeded dailyKcal, forcing fat down toward
   * its 0.6 g/kg floor and/or carbs down to 0 (AS-025).
   */
  clamped: boolean;
}

/**
 * Protein/fat/carb split for a given bodyweight and daily kcal budget
 * (AS-025):
 *  - protein: fixed at PROTEIN_G_PER_KG (2.0 g/kg, within the clarified
 *    1.8-2.2 g/kg range)
 *  - fat: FAT_G_PER_KG_DEFAULT (0.8 g/kg) normally, pulled down toward the
 *    FAT_G_PER_KG_MIN (0.6 g/kg) floor -- but never below it -- when the
 *    kcal budget is too tight to fit protein + default fat
 *  - carbs: whatever kcal remain (protein & carbs at 4 kcal/g, fat at
 *    9 kcal/g), clamped to never go negative
 *
 * When the budget is too tight to fit even protein + fat-at-floor, we walk
 * the two down in priority order -- fat first (toward its 0.6 g/kg floor),
 * then, only if still over, protein (toward its 1.6 g/kg floor) -- so the
 * split always fits the kcal budget instead of pushing carbs negative. In
 * every tight case `clamped` is true so the caller (F016 UI) can note that
 * the plan is unusually tight. Only in the truly extreme edge (protein@1.6 +
 * fat@0.6 still over budget) does carbs land at 0 with a small overshoot.
 */
export function macroTargets(weightKg: number, dailyKcal: number): MacroTargets {
  const w = clampNumber(weightKg, MIN_WEIGHT_KG, MAX_WEIGHT_KG);
  const kcal = Math.max(0, dailyKcal);

  const defaultProteinG = round1(w * PROTEIN_G_PER_KG);
  const proteinFloorG = round1(w * PROTEIN_G_PER_KG_MIN);
  const defaultFatG = round1(w * FAT_G_PER_KG_DEFAULT);
  const fatFloorG = round1(w * FAT_G_PER_KG_MIN);

  let proteinG = defaultProteinG;
  let fatG = defaultFatG;
  let clamped = false;

  // Step 1: fat gives way first -- pull it down toward its floor to fit.
  if (proteinG * 4 + fatG * 9 > kcal) {
    clamped = true;
    const fatKcalBudget = Math.max(0, kcal - proteinG * 4);
    fatG = Math.max(fatFloorG, Math.min(defaultFatG, round1(fatKcalBudget / 9)));
  }

  // Step 2: only once fat is already pinned at its floor AND the split still
  // overflows does protein give way -- down toward its 1.6 g/kg muscle-sparing
  // floor. Gating on `fatG === fatFloorG` (not a bare kcal compare) avoids a
  // sub-kcal rounding overshoot spuriously trimming protein.
  if (fatG === fatFloorG && proteinG * 4 + fatG * 9 > kcal) {
    clamped = true;
    const proteinKcalBudget = Math.max(0, kcal - fatG * 9);
    proteinG = Math.max(
      proteinFloorG,
      Math.min(defaultProteinG, round1(proteinKcalBudget / 4))
    );
  }

  const carbsKcal = Math.max(0, kcal - proteinG * 4 - fatG * 9);
  const carbsG = round1(carbsKcal / 4);

  return {
    proteinG,
    fatG,
    carbsG,
    clamped,
  };
}

// ---------------------------------------------------------------------
// Weekly budget
// ---------------------------------------------------------------------

/** Weekly budget for a full 7-day week: daily target * 7 (AS-026). */
export function weeklyBudget(dailyKcal: number): number {
  const daily = Math.max(0, roundKcal(dailyKcal));

  return daily * 7;
}

// ---------------------------------------------------------------------
// Goal-adjustment (AS-030)
// ---------------------------------------------------------------------

export type GoalAdjustReasonCode =
  | "deficit_capped_25_percent"
  | "floor_kcal_applied"
  | "surplus_capped_20_percent"
  /**
   * The sex-specific kcal floor is at or above this person's TDEE, so there
   * is NO safe way to create a deficit through food alone (a very small /
   * older / sedentary person). We cap the daily target at TDEE (maintenance
   * via food) rather than handing back a "deficit" that is actually a surplus
   * -- the UI should then steer the deficit toward activity instead.
   */
  | "floor_exceeds_tdee";

export interface GoalAdjustmentInput {
  sex: Sex;
  currentWeightKg: number;
  targetWeightKg: number;
  timeframeWeeks: number;
  tdeeKcal: number;
}

export interface GoalAdjustmentResult {
  /** Final clamped daily kcal target. */
  dailyKcal: number;
  /** dailyKcal * 7. */
  weeklyKcal: number;
  /** The deficit the raw goal (weight delta / timeframe) implied, pre-clamp. */
  impliedDeficitPct: number;
  /** The deficit actually applied after clamping to the safe caps. */
  appliedDeficitPct: number;
  /** True when the goal had to be adjusted to stay within the safe caps. */
  adjusted: boolean;
  /**
   * Machine-readable reasons for the adjustment, in the order the caps
   * were applied. The Serbian explanation copy lives in the UI layer
   * (F016), not here.
   */
  reasonCodes: GoalAdjustReasonCode[];
}

/**
 * Given a target weight + timeframe, derives the implied daily deficit
 * (via KCAL_PER_KG_BODY_MASS) and clamps it to the same two safety caps as
 * `dailyTarget`: the 25% max deficit (AS-024) and the sex-specific kcal
 * floor (AS-023). When either cap engages, `adjusted` is true and the
 * matching reason code(s) are returned so the UI can show a Serbian
 * explanation (AS-030).
 *
 * A target weight at or above the current weight (maintenance/gain) or a
 * non-positive timeframe never throws -- see the edge-case tests in
 * engine.test.ts for the exact clamped behaviour.
 */
export function planGoalAdjustment(
  input: GoalAdjustmentInput
): GoalAdjustmentResult {
  const sex = input.sex;
  const tdeeKcal = Math.max(0, input.tdeeKcal);
  const currentWeightKg = clampNumber(
    input.currentWeightKg,
    MIN_WEIGHT_KG,
    MAX_WEIGHT_KG
  );
  const targetWeightKg = clampNumber(
    input.targetWeightKg,
    MIN_WEIGHT_KG,
    MAX_WEIGHT_KG
  );
  // A zero/negative timeframe is nonsensical but must not throw; treat it
  // as the shortest possible plan (1 week) rather than dividing by zero.
  const timeframeWeeks = Math.max(1, Math.round(input.timeframeWeeks) || 1);

  const weightDeltaKg = currentWeightKg - targetWeightKg;

  // Maintenance or a weight-gain goal implies no fat-loss deficit at all;
  // nothing to cap or adjust.
  if (weightDeltaKg <= 0) {
    const dailyKcal = roundKcal(tdeeKcal);

    return {
      dailyKcal,
      weeklyKcal: dailyKcal * 7,
      impliedDeficitPct: 0,
      appliedDeficitPct: 0,
      adjusted: false,
      reasonCodes: [],
    };
  }

  const totalDeficitKcal = weightDeltaKg * KCAL_PER_KG_BODY_MASS;
  const totalDays = timeframeWeeks * 7;
  const impliedDailyDeficitKcal = totalDeficitKcal / totalDays;
  const impliedDeficitPct =
    tdeeKcal > 0 ? impliedDailyDeficitKcal / tdeeKcal : 0;

  const reasonCodes: GoalAdjustReasonCode[] = [];
  let adjusted = false;
  let appliedDeficitPct = impliedDeficitPct;

  if (appliedDeficitPct > MAX_DEFICIT_PCT) {
    appliedDeficitPct = MAX_DEFICIT_PCT;
    adjusted = true;
    reasonCodes.push("deficit_capped_25_percent");
  } else if (appliedDeficitPct < 0) {
    appliedDeficitPct = 0;
  }

  const floor = KCAL_FLOOR[sex] ?? KCAL_FLOOR.male;
  const rawDailyKcal = roundKcal(tdeeKcal * (1 - appliedDeficitPct));

  let dailyKcal = rawDailyKcal;
  if (rawDailyKcal < floor) {
    dailyKcal = floor;
    adjusted = true;
    reasonCodes.push("floor_kcal_applied");
    appliedDeficitPct = tdeeKcal > 0 ? 1 - dailyKcal / tdeeKcal : 0;
  }

  // The floor must never push the target above TDEE (would turn a weight-loss
  // plan into a surplus for a very small/sedentary person). Cap at TDEE and
  // flag it so the UI can steer the deficit toward activity instead of food.
  if (dailyKcal > tdeeKcal) {
    dailyKcal = tdeeKcal;
    adjusted = true;
    // The floor we just applied is itself above TDEE, so "floor applied" would
    // be misleading -- replace it with the more accurate floor_exceeds_tdee.
    const i = reasonCodes.indexOf("floor_kcal_applied");
    if (i !== -1) reasonCodes.splice(i, 1);
    reasonCodes.push("floor_exceeds_tdee");
    appliedDeficitPct = 0;
  }

  return {
    dailyKcal,
    weeklyKcal: dailyKcal * 7,
    impliedDeficitPct,
    appliedDeficitPct,
    adjusted,
    reasonCodes,
  };
}

/**
 * Mirror of `planGoalAdjustment` for a weight-GAIN goal: derives the implied
 * daily surplus from a target weight ABOVE the current one over the timeframe,
 * clamps it to `MAX_SURPLUS_PCT`, and returns `TDEE * (1 + surplus)`. A target
 * at or below current implies no surplus (just maintenance). The surplus is
 * recorded as a negative deficit on the shared result shape so callers/UI can
 * treat "deficit" as a single signed lever (negative = eating above TDEE).
 *
 * NOTE on KCAL_PER_KG_BODY_MASS (7700): that is the energy density of FAT,
 * whereas muscle is only ~1800-2700 kcal/kg -- so using 7700 for a muscle-gain
 * goal is a deliberate, clinically-sanctioned simplification, not an oversight.
 * In practice it lands on the right number: a healthy lean-bulk target weight
 * over a sane timeframe implies ~0.25 kg/week, i.e. 0.25*7700/7 ~= +275 kcal/day
 * -- a textbook lean-bulk surplus. The MAX_SURPLUS_PCT (20%) cap plus the UI's
 * >0.5%/week pace warning keep faster (fat-heavy) requests in check.
 */
export function planWeightGain(
  input: GoalAdjustmentInput
): GoalAdjustmentResult {
  const tdeeKcal = Math.max(0, input.tdeeKcal);
  const currentWeightKg = clampNumber(
    input.currentWeightKg,
    MIN_WEIGHT_KG,
    MAX_WEIGHT_KG
  );
  const targetWeightKg = clampNumber(
    input.targetWeightKg,
    MIN_WEIGHT_KG,
    MAX_WEIGHT_KG
  );
  const timeframeWeeks = Math.max(1, Math.round(input.timeframeWeeks) || 1);

  const gainKg = targetWeightKg - currentWeightKg;
  if (gainKg <= 0) {
    const dailyKcal = roundKcal(tdeeKcal);
    return {
      dailyKcal,
      weeklyKcal: dailyKcal * 7,
      impliedDeficitPct: 0,
      appliedDeficitPct: 0,
      adjusted: false,
      reasonCodes: [],
    };
  }

  const totalSurplusKcal = gainKg * KCAL_PER_KG_BODY_MASS;
  const impliedDailySurplusKcal = totalSurplusKcal / (timeframeWeeks * 7);
  const impliedSurplusPct =
    tdeeKcal > 0 ? impliedDailySurplusKcal / tdeeKcal : 0;

  const reasonCodes: GoalAdjustReasonCode[] = [];
  let adjusted = false;
  let appliedSurplusPct = impliedSurplusPct;

  if (appliedSurplusPct > MAX_SURPLUS_PCT) {
    appliedSurplusPct = MAX_SURPLUS_PCT;
    adjusted = true;
    reasonCodes.push("surplus_capped_20_percent");
  }

  const dailyKcal = roundKcal(tdeeKcal * (1 + appliedSurplusPct));

  return {
    dailyKcal,
    weeklyKcal: dailyKcal * 7,
    // Negative deficit == surplus (eating above TDEE).
    impliedDeficitPct: -impliedSurplusPct,
    appliedDeficitPct: -appliedSurplusPct,
    adjusted,
    reasonCodes,
  };
}

export interface GoalPlanInput {
  goal: GoalType;
  sex: Sex;
  currentWeightKg: number;
  /** Present only for weight-change goals (lose/gain); null for maintain/tone. */
  targetWeightKg: number | null;
  timeframeWeeks: number | null;
  tdeeKcal: number;
}

/**
 * The single entry point the onboarding summary + persist use: turns the
 * chosen goal type into a daily/weekly kcal plan.
 *  - `maintain` -> eat at maintenance (TDEE), no adjustment
 *  - `tone`     -> eat at a mild fixed deficit (TONE_DEFICIT_PCT, ~10%) for
 *                  body recomposition; no target weight / timeframe needed,
 *                  still clamped to the sex-specific kcal floor
 *  - `lose`     -> `planGoalAdjustment` (deficit from target weight)
 *  - `gain`     -> `planWeightGain` (surplus toward target weight)
 *
 * Missing target/timeframe (maintain/tone, or a partially-filled edge) never
 * throws -- it degrades to maintenance.
 */
export function planForGoal(input: GoalPlanInput): GoalAdjustmentResult {
  const tdeeKcal = Math.max(0, roundKcal(input.tdeeKcal));

  // `tone` = body recomposition: a mild fixed deficit below maintenance,
  // independent of any target weight (that step is skipped for tone). Mirrors
  // the floor-clamp logic of `dailyTarget`.
  if (input.goal === "tone") {
    const floor = KCAL_FLOOR[input.sex] ?? KCAL_FLOOR.male;
    const raw = roundKcal(tdeeKcal * (1 - TONE_DEFICIT_PCT));
    const floored = Math.max(raw, floor);
    // Same guard as the lose path: the floor must never lift the target above
    // TDEE (surplus while trying to recomp). Cap at TDEE and flag it.
    const dailyKcal = Math.min(floored, tdeeKcal);
    const reasonCodes: GoalAdjustReasonCode[] = [];
    // At most one of these: if the floor itself exceeds TDEE, that's the
    // accurate story (capped at TDEE); otherwise, if the floor merely lifted
    // the raw deficit, flag that.
    if (floored > tdeeKcal) {
      reasonCodes.push("floor_exceeds_tdee");
    } else if (floored !== raw) {
      reasonCodes.push("floor_kcal_applied");
    }
    const appliedDeficitPct = tdeeKcal > 0 ? 1 - dailyKcal / tdeeKcal : 0;

    return {
      dailyKcal,
      weeklyKcal: dailyKcal * 7,
      impliedDeficitPct: TONE_DEFICIT_PCT,
      appliedDeficitPct,
      adjusted: reasonCodes.length > 0,
      reasonCodes,
    };
  }

  if (
    input.goal === "maintain" ||
    input.targetWeightKg === null ||
    input.timeframeWeeks === null
  ) {
    return {
      dailyKcal: tdeeKcal,
      weeklyKcal: tdeeKcal * 7,
      impliedDeficitPct: 0,
      appliedDeficitPct: 0,
      adjusted: false,
      reasonCodes: [],
    };
  }

  const shared = {
    sex: input.sex,
    currentWeightKg: input.currentWeightKg,
    targetWeightKg: input.targetWeightKg,
    timeframeWeeks: input.timeframeWeeks,
    tdeeKcal: input.tdeeKcal,
  };

  return input.goal === "gain"
    ? planWeightGain(shared)
    : planGoalAdjustment(shared);
}
