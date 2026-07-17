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
  bmr,
  macroTargets,
  planGoalAdjustment,
  tdee,
} from "@/lib/budget/engine";
import type {
  GoalAdjustReasonCode,
  GoalAdjustmentResult,
  MacroTargets,
} from "@/lib/budget/engine";
import { ONBOARDING_QUERY_KEYS } from "@/lib/onboarding/types";
import type { ActivityLevel, OnboardingData, Sex } from "@/lib/onboarding/types";

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

function parseNumber(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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
    sex: parseSex(readParam(params, ONBOARDING_QUERY_KEYS.sex)),
    ageYears: parseNumber(readParam(params, ONBOARDING_QUERY_KEYS.ageYears)),
    heightCm: parseNumber(readParam(params, ONBOARDING_QUERY_KEYS.heightCm)),
    weightKg: parseNumber(readParam(params, ONBOARDING_QUERY_KEYS.weightKg)),
    activityLevel: parseActivityLevel(
      readParam(params, ONBOARDING_QUERY_KEYS.activityLevel)
    ),
    targetWeightKg: parseNumber(
      readParam(params, ONBOARDING_QUERY_KEYS.targetWeightKg)
    ),
    timeframeWeeks: parseNumber(
      readParam(params, ONBOARDING_QUERY_KEYS.timeframeWeeks)
    ),
  };
}

/** `OnboardingData` with every field guaranteed non-null -- what the F014
 * engine functions actually need. */
export interface CompleteOnboardingData {
  sex: Sex;
  ageYears: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  targetWeightKg: number;
  timeframeWeeks: number;
}

/** Type guard: true when every field is present (not necessarily *valid* --
 * range validation is `@/lib/onboarding/validation`'s job; this only guards
 * against `computeBudgetSummary` being called with a `null` and crashing). */
export function isOnboardingDataComplete(
  data: OnboardingData
): data is CompleteOnboardingData {
  return (
    data.sex !== null &&
    data.ageYears !== null &&
    data.heightCm !== null &&
    data.weightKg !== null &&
    data.activityLevel !== null &&
    data.targetWeightKg !== null &&
    data.timeframeWeeks !== null
  );
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
  const goal = planGoalAdjustment({
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
  const floorKcal = KCAL_FLOOR[sex] ?? KCAL_FLOOR.male;

  return reasonCodes
    .map((code): string => {
      switch (code) {
        case "deficit_capped_25_percent":
          return `Tvoj cilj bi zahtevao veći dnevni deficit nego što je bezbedno, zato smo ga ograničili na najviše ${maxDeficitPercent}% ispod tvog dnevnog utroška energije (TDEE).`;
        case "floor_kcal_applied":
          return `Dnevni kalorijski cilj je prilagođen na najniži bezbedan nivo od ${floorKcal} kcal, da ne bi unosio/la premalo.`;
        default:
          return "";
      }
    })
    .filter((message) => message.length > 0);
}

/** Re-exported for callers that only need the activity-multiplier table
 * (e.g. tests asserting AS-022 indirectly through this module). */
export { ACTIVITY_MULTIPLIERS };
