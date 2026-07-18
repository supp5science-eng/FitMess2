/**
 * F015: pure, framework-free client-side validation for each onboarding
 * step (AS-019). Deliberately mirrors the pattern `src/lib/auth/route-protection.ts`
 * established -- plain functions taking primitives in, returning a plain
 * result out, unit-testable without rendering anything -- so the same rules
 * back both the inline Serbian field errors in the wizard UI and a
 * standalone test suite.
 *
 * Ranges per the F015 clarified spec ("Client-side validation with
 * sensible ranges per step"): age ~14-100, height ~120-230 cm, weight
 * ~35-300 kg, target weight sane vs current, timeframe >=1 week. These are
 * intentionally a bit tighter than `src/lib/budget/engine.ts`'s own
 * defensive clamp bounds (13-100 / 100-250 / 30-300) -- the engine's bounds
 * are a last-resort safety clamp for data that already slipped past this
 * validation (e.g. future direct-DB edits); this module is the actual
 * front door a real user's typed input passes through first.
 */

import type { ActivityLevel, GoalType, Sex } from "@/lib/types/db";

export const MIN_AGE_YEARS = 14;
export const MAX_AGE_YEARS = 100;
export const MIN_HEIGHT_CM = 100;
export const MAX_HEIGHT_CM = 250;
export const MIN_WEIGHT_KG = 35;
export const MAX_WEIGHT_KG = 300;
export const MIN_TIMEFRAME_WEEKS = 1;
/** 2 years -- generous upper bound on a fat-loss pacing goal; anything
 * longer isn't a meaningful "timeframe" input anymore. */
export const MAX_TIMEFRAME_WEEKS = 104;

const VALID_SEX_VALUES: Sex[] = ["male", "female"];
const VALID_ACTIVITY_LEVELS: ActivityLevel[] = [
  "sedentary",
  "light",
  "moderate",
  "active",
  "very_active",
];
const VALID_GOAL_TYPES: GoalType[] = ["maintain", "lose", "gain", "tone"];

export type ValidationResult =
  | { valid: true }
  | { valid: false; error: string };

const VALID: ValidationResult = { valid: true };

function invalid(error: string): ValidationResult {
  return { valid: false, error };
}

/** AS-019 step 1 (pol): must pick one of the two options. */
export function validateSex(sex: Sex | null): ValidationResult {
  if (sex !== null && VALID_SEX_VALUES.includes(sex)) return VALID;
  return invalid("Izaberi pol da bi nastavio/nastavila.");
}

/** AS-019 step 2 (godine): a whole number of years, 14-100. */
export function validateAge(age: number | null): ValidationResult {
  if (age === null || Number.isNaN(age)) {
    return invalid("Unesi svoje godine.");
  }
  if (!Number.isInteger(age)) {
    return invalid("Godine unesi kao ceo broj.");
  }
  if (age < MIN_AGE_YEARS || age > MAX_AGE_YEARS) {
    return invalid(`Unesi broj godina između ${MIN_AGE_YEARS} i ${MAX_AGE_YEARS}.`);
  }
  return VALID;
}

/** AS-019 step 3 (visina): centimeters, 100-250. */
export function validateHeight(heightCm: number | null): ValidationResult {
  if (heightCm === null || Number.isNaN(heightCm)) {
    return invalid("Unesi svoju visinu.");
  }
  if (heightCm < MIN_HEIGHT_CM || heightCm > MAX_HEIGHT_CM) {
    return invalid(
      `Unesi visinu između ${MIN_HEIGHT_CM} i ${MAX_HEIGHT_CM} cm.`
    );
  }
  return VALID;
}

/** AS-019 step 4 (težina): kilograms, 35-300. */
export function validateWeight(weightKg: number | null): ValidationResult {
  if (weightKg === null || Number.isNaN(weightKg)) {
    return invalid("Unesi svoju težinu.");
  }
  if (weightKg < MIN_WEIGHT_KG || weightKg > MAX_WEIGHT_KG) {
    return invalid(
      `Unesi težinu između ${MIN_WEIGHT_KG} i ${MAX_WEIGHT_KG} kg.`
    );
  }
  return VALID;
}

/** AS-019 step 5 (nivo aktivnosti): one of the five tiers. */
export function validateActivityLevel(
  level: ActivityLevel | null
): ValidationResult {
  if (level !== null && VALID_ACTIVITY_LEVELS.includes(level)) return VALID;
  return invalid("Izaberi nivo aktivnosti da bi nastavio/nastavila.");
}

/** The goal-type step: must pick one of the four objectives. */
export function validateGoalType(goal: GoalType | null): ValidationResult {
  if (goal !== null && VALID_GOAL_TYPES.includes(goal)) return VALID;
  return invalid("Izaberi svoj cilj da bi nastavio/nastavila.");
}

/**
 * AS-019 step 6 (cilj): target weight + timeframe together, validated as
 * one step (per the clarified spec's "cilj (target kg + weeks)" step).
 * `currentWeightKg` is the value collected in step 4, used for the
 * "target weight sane vs current" rule. `goal` sets the direction of that
 * rule: a `lose` target must be meaningfully below the current weight, a
 * `gain` target meaningfully above it. Only called for the weight-change
 * goals (`lose`/`gain`); `maintain`/`tone` skip this step entirely.
 */
export function validateGoal(
  targetWeightKg: number | null,
  timeframeWeeks: number | null,
  currentWeightKg: number | null,
  goal: GoalType = "lose"
): ValidationResult {
  if (targetWeightKg === null || Number.isNaN(targetWeightKg)) {
    return invalid("Unesi svoju ciljnu težinu.");
  }
  if (targetWeightKg < MIN_WEIGHT_KG || targetWeightKg > MAX_WEIGHT_KG) {
    return invalid(
      `Unesi ciljnu težinu između ${MIN_WEIGHT_KG} i ${MAX_WEIGHT_KG} kg.`
    );
  }
  if (currentWeightKg !== null && !Number.isNaN(currentWeightKg)) {
    if (goal === "gain") {
      if (targetWeightKg <= currentWeightKg) {
        return invalid("Ciljna težina treba da bude veća od trenutne.");
      }
    } else if (targetWeightKg >= currentWeightKg) {
      return invalid("Ciljna težina treba da bude manja od trenutne.");
    }
  }
  if (timeframeWeeks === null || Number.isNaN(timeframeWeeks)) {
    return invalid("Unesi rok u nedeljama.");
  }
  if (!Number.isInteger(timeframeWeeks)) {
    return invalid("Rok unesi kao ceo broj nedelja.");
  }
  if (
    timeframeWeeks < MIN_TIMEFRAME_WEEKS ||
    timeframeWeeks > MAX_TIMEFRAME_WEEKS
  ) {
    return invalid(
      `Unesi rok između ${MIN_TIMEFRAME_WEEKS} i ${MAX_TIMEFRAME_WEEKS} nedelja.`
    );
  }
  return VALID;
}
