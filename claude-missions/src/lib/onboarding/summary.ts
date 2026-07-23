/**
 * F016: pure helpers for the onboarding summary screen
 * (`/onboarding/pregled`, AS-020, AS-030, AS-031).
 *
 * Two responsibilities, kept framework-free and unit-testable in isolation
 * (mirrors the F015 `validation.ts` pattern):
 *
 *  1. Parsing the query-string hand-off F015's wizard produces
 *     (`buildOnboardingSummaryUrl` in `@/lib/onboarding/types`) back into an
 *     `OnboardingData` value, tolerating missing/malformed params rather
 *     than throwing (a direct/bookmarked visit to `/onboarding/pregled`
 *     with no query string must render the empty state, not crash).
 *  2. Deriving the F014 budget-engine output (BMR/TDEE/daily+weekly
 *     kcal/macros/goal-adjustment) from a *complete* `OnboardingData` value
 *     -- this is what both the server-rendered initial summary and every
 *     client-side inline edit (AS-020: "editing a value ... recomputes the
 *     budget live") call, so the initial render and every subsequent edit
 *     always go through the exact same F014 engine functions (the
 *     "Money-math rule": budget arithmetic never re-implemented ad hoc in
 *     UI code).
 */

import {
  ACTIVITY_MULTIPLIERS,
  KCAL_FLOOR,
  MAX_DEFICIT_PCT,
  MAX_SURPLUS_PCT,
  bmr,
  macroTargets,
  planForGoal,
  tdee,
} from "@/lib/budget/engine";
import type {
  GoalAdjustReasonCode,
  GoalAdjustmentResult,
  MacroTargets,
} from "@/lib/budget/engine";
import { ONBOARDING_QUERY_KEYS } from "@/lib/onboarding/types";
import type { WeightChangePace } from "@/lib/onboarding/pace";
import type {
  ActivityLevel,
  GoalType,
  OnboardingData,
  Sex,
} from "@/lib/onboarding/types";

// ---------------------------------------------------------------------
// Query-string parsing (the F015 -> F016 hand-off, read side)
// ---------------------------------------------------------------------

/** Shape Next.js hands a Server Component's `searchParams` in as. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

const VALID_SEX_VALUES: Sex[] = ["male", "female"];
const VALID_ACTIVITY_LEVELS: ActivityLevel[] = [
  "sedentary",
  "light",
  "moderate",
  "active",
  "very_active",
];
const VALID_GOAL_TYPES: GoalType[] = ["maintain", "lose", "gain", "tone"];
const WEIGHT_CHANGE_GOALS: GoalType[] = ["lose", "gain"];

function readParam(params: RawSearchParams, key: string): string | null {
  const value = params[key];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function parseSex(value: string | null): Sex | null {
  return value !== null && VALID_SEX_VALUES.includes(value as Sex)
    ? (value as Sex)
    : null;
}

function parseActivityLevel(value: string | null): ActivityLevel | null {
  return value !== null &&
    VALID_ACTIVITY_LEVELS.includes(value as ActivityLevel)
    ? (value as ActivityLevel)
    : null;
}

function parseGoalType(value: string | null): GoalType | null {
  return value !== null && VALID_GOAL_TYPES.includes(value as GoalType)
    ? (value as GoalType)
    : null;
}

function parseNumber(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseName(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Reads the seven `ONBOARDING_QUERY_KEYS` params F015's wizard hands off.
 * Never throws -- an absent or malformed param simply becomes `null` on
 * that field, which `isOnboardingDataComplete` below then catches so the
 * page can render its empty state instead of a broken/blank screen.
 */
export function parseOnboardingSearchParams(
  params: RawSearchParams
): OnboardingData {
  return {
    name: parseName(readParam(params, ONBOARDING_QUERY_KEYS.name)),
    sex: parseSex(readParam(params, ONBOARDING_QUERY_KEYS.sex)),
    ageYears: parseNumber(readParam(params, ONBOARDING_QUERY_KEYS.ageYears)),
    heightCm: parseNumber(readParam(params, ONBOARDING_QUERY_KEYS.heightCm)),
    weightKg: parseNumber(readParam(params, ONBOARDING_QUERY_KEYS.weightKg)),
    activityLevel: parseActivityLevel(
      readParam(params, ONBOARDING_QUERY_KEYS.activityLevel)
    ),
    goal: parseGoalType(readParam(params, ONBOARDING_QUERY_KEYS.goal)),
    targetWeightKg: parseNumber(
      readParam(params, ONBOARDING_QUERY_KEYS.targetWeightKg)
    ),
    // Pace isn't carried in the (legacy) query-string hand-off; the timeframe
    // it derives IS. Left null here — nothing downstream of this parse reads
    // it (the budget engine consumes `timeframeWeeks`).
    pace: null,
    timeframeWeeks: parseNumber(
      readParam(params, ONBOARDING_QUERY_KEYS.timeframeWeeks)
    ),
  };
}

/** `OnboardingData` with every *required* field present -- what the F014
 * engine functions need. `targetWeightKg`/`timeframeWeeks` stay nullable
 * because maintain/tone goals legitimately have none. `name` stays nullable
 * too: the questionnaire is anonymous and the name is only filled in
 * post-registration (the "kako da te zovemo" screen), right before persist. */
export interface CompleteOnboardingData {
  name: string | null;
  sex: Sex;
  ageYears: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: GoalType;
  targetWeightKg: number | null;
  /** Optional; carried through so a `CompleteOnboardingData` is still a
   * structural `OnboardingData` (persist/save accept it). Not used by the
   * budget engine, which reads `timeframeWeeks`. */
  pace?: WeightChangePace | null;
  timeframeWeeks: number | null;
}

/** Type guard: true when every field needed to compute a plan is present.
 * For maintain/tone that's everything except target/timeframe; for lose/gain
 * the target weight + timeframe are required too. The name is deliberately
 * NOT required — the budget engine never reads it and the questionnaire no
 * longer collects it (it arrives post-registration). (Range *validity* is
 * `@/lib/onboarding/validation`'s job; this only guards against
 * `computeBudgetSummary` crashing on a missing input.) */
export function isOnboardingDataComplete(
  data: OnboardingData
): data is CompleteOnboardingData {
  const baseComplete =
    data.sex !== null &&
    data.ageYears !== null &&
    data.heightCm !== null &&
    data.weightKg !== null &&
    data.activityLevel !== null &&
    data.goal !== null;

  if (!baseComplete || data.goal === null) return false;

  if (WEIGHT_CHANGE_GOALS.includes(data.goal)) {
    return data.targetWeightKg !== null && data.timeframeWeeks !== null;
  }
  return true;
}

// ---------------------------------------------------------------------
// Budget derivation (AS-020 live recompute, AS-030 goal-adjust display)
// ---------------------------------------------------------------------

export interface BudgetSummary {
  bmrKcal: number;
  tdeeKcal: number;
  /** Final clamped daily kcal target (post goal-adjust). */
  dailyKcal: number;
  /** dailyKcal * 7. */
  weeklyKcal: number;
  macros: MacroTargets;
  /** The full F014 goal-adjustment result, so the UI can show the
   * adjusted/reasonCodes explanation (AS-030) without recomputing it. */
  goal: GoalAdjustmentResult;
}

/**
 * Runs a complete onboarding data value through the F014 engine
 * (bmr -> tdee -> planGoalAdjustment -> macroTargets), in the exact same
 * order/composition every time -- called once for the server-rendered
 * initial summary and again on every client-side edit (AS-020).
 */
export function computeBudgetSummary(
  data: CompleteOnboardingData
): BudgetSummary {
  const bmrKcal = bmr(data.sex, data.weightKg, data.heightCm, data.ageYears);
  const tdeeKcal = tdee(bmrKcal, data.activityLevel);
  const goal = planForGoal({
    goal: data.goal,
    sex: data.sex,
    currentWeightKg: data.weightKg,
    targetWeightKg: data.targetWeightKg,
    timeframeWeeks: data.timeframeWeeks,
    tdeeKcal,
  });
  const macros = macroTargets(data.weightKg, goal.dailyKcal);

  return {
    bmrKcal,
    tdeeKcal,
    dailyKcal: goal.dailyKcal,
    weeklyKcal: goal.weeklyKcal,
    macros,
    goal,
  };
}

// ---------------------------------------------------------------------
// AS-030: Serbian explanation copy for an adjusted goal
// ---------------------------------------------------------------------

/**
 * Turns the F014 engine's machine-readable `reasonCodes` into calm Serbian
 * sentences (AS-030: "... with a Serbian explanation shown"). The engine
 * itself deliberately never phrases anything in natural language (per
 * `engine.ts`'s own doc comment: "The Serbian explanation copy lives in the
 * UI layer (F016), not here") -- this is that UI layer.
 */
export function explainGoalAdjustment(
  reasonCodes: GoalAdjustReasonCode[],
  sex: Sex
): string[] {
  const maxDeficitPercent = Math.round(MAX_DEFICIT_PCT * 100);
  const maxSurplusPercent = Math.round(MAX_SURPLUS_PCT * 100);
  const floorKcal = KCAL_FLOOR[sex] ?? KCAL_FLOOR.male;

  return reasonCodes
    .map((code): string => {
      switch (code) {
        case "deficit_capped_25_percent":
          return `Tvoj cilj bi zahtevao veći dnevni deficit nego što je bezbedno, zato smo ga ograničili na najviše ${maxDeficitPercent}% ispod tvog dnevnog utroška energije (TDEE).`;
        case "floor_kcal_applied":
          return `Dnevni kalorijski cilj je prilagođen na najniži bezbedan nivo od ${floorKcal} kcal, da ne bi unosio/la premalo.`;
        case "surplus_capped_20_percent":
          return `Tvoj cilj bi zahtevao veći dnevni višak nego što je zdravo za čisto dobijanje mase, zato smo ga ograničili na najviše ${maxSurplusPercent}% iznad tvog dnevnog utroška energije (TDEE).`;
        case "floor_exceeds_tdee":
          return `Tvoj dnevni utrošak energije je nizak, pa bi bezbedan minimalni unos (${floorKcal} kcal) bio veći od njega. Zato smo dnevni cilj postavili na održavanje — kod tebe je deficit bezbednije praviti kroz aktivnost (šetnja, trening) nego dodatnim rezanjem hrane.`;
        default:
          return "";
      }
    })
    .filter((message) => message.length > 0);
}

/** Re-exported for callers that only need the activity-multiplier table
 * (e.g. tests asserting AS-022 indirectly through this module). */
export { ACTIVITY_MULTIPLIERS };
