/**
 * F015: shared shape for the onboarding wizard's collected inputs.
 *
 * Deliberately collects `ageYears` (not `birthYear`) even though
 * `public.profiles.birth_year` is the persisted column -- AS-019's own
 * wording says the wizard collects "age", and `src/lib/budget/engine.ts`'s
 * `bmr()` takes `ageYears` directly, so carrying age (not a derived birth
 * year) through the handoff to F016 is what the very next consumer
 * (`planGoalAdjustment`/`bmr`) actually needs. F016 is responsible for
 * converting `ageYears` -> `birth_year` at persist time, and for the actual
 * DB write -- this feature only collects and carries the data forward (see
 * the F015 clarified spec: "do not implement the final save here").
 */

import type { ActivityLevel, GoalType, Sex } from "@/lib/types/db";
import type { WeightChangePace } from "@/lib/onboarding/pace";
import { DEFAULT_PACE } from "@/lib/onboarding/pace";

export type { ActivityLevel, GoalType, Sex };

export interface OnboardingData {
  name: string | null;
  sex: Sex | null;
  ageYears: number | null;
  heightCm: number | null;
  weightKg: number | null;
  activityLevel: ActivityLevel | null;
  goal: GoalType | null;
  targetWeightKg: number | null;
  /** Chosen weight-change pace (slow/recommended/fast). Drives `timeframeWeeks`
   * — the `tempo` step derives the timeframe from this + the target delta, and
   * the timeframe is what the budget engine + DB consume. Optional/null for
   * maintain/tone goals (no target to pace toward) and for older callers that
   * predate the pace step; readers fall back to `DEFAULT_PACE`. */
  pace?: WeightChangePace | null;
  timeframeWeeks: number | null;
}

export const EMPTY_ONBOARDING_DATA: OnboardingData = {
  name: null,
  sex: null,
  ageYears: null,
  heightCm: null,
  weightKg: null,
  activityLevel: null,
  goal: null,
  targetWeightKg: null,
  pace: null,
  timeframeWeeks: null,
};

/**
 * The values the wizard starts with. The numeric steps (godine/visina/težina)
 * use a native picker whose opening position is its currently-selected value,
 * so pre-selecting a sensible middle-of-the-range default lands the wheel there
 * ("gde počinje kada neko krene da ide gore-dole") instead of at the very
 * bottom of the range. Non-numeric steps (pol, aktivnost, cilj...) stay unset
 * so the user still makes a deliberate choice.
 */
export const DEFAULT_ONBOARDING_DATA: OnboardingData = {
  ...EMPTY_ONBOARDING_DATA,
  ageYears: 25,
  heightCm: 175,
  weightKg: 75,
  // The `tempo` step opens on the recommended pace so a plan is always
  // computable even if the user never touches the slider.
  pace: DEFAULT_PACE,
};

/** Every possible step, in order. The name (`ime`) comes late — after the
 * demographics + goal type — and the two goal-only steps (`cilj` = target
 * weight, `tempo` = pace) are conditional (see `visibleStepIds`), since
 * maintain/tone goals have no target to collect. */
export const ONBOARDING_STEP_IDS = [
  "pol",
  "godine",
  "visina",
  "tezina",
  "aktivnost",
  "cilj-tip",
  "ime",
  "cilj",
  "tempo",
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEP_IDS)[number];

/** Goals that need a concrete target weight (and therefore the `cilj` +
 * `tempo` steps); maintain/tone skip both. */
const WEIGHT_CHANGE_GOALS: GoalType[] = ["lose", "gain"];

/** The two steps that only make sense once the user is changing weight toward
 * a target: the target-weight ruler (`cilj`) and the pace slider (`tempo`). */
const WEIGHT_CHANGE_STEPS: OnboardingStepId[] = ["cilj", "tempo"];

/**
 * The steps actually shown for the current goal selection. The target-weight
 * (`cilj`) and pace (`tempo`) steps only appear for the weight-change goals;
 * for maintain/tone the wizard finishes right after the name step. Before a
 * goal is picked (`null`), both are omitted so the progress count matches the
 * shortest path until the user commits to a weight-change goal.
 */
export function visibleStepIds(goal: GoalType | null): OnboardingStepId[] {
  const includesGoalSteps = goal !== null && WEIGHT_CHANGE_GOALS.includes(goal);
  return ONBOARDING_STEP_IDS.filter(
    (id) => !WEIGHT_CHANGE_STEPS.includes(id) || includesGoalSteps
  );
}

/** The five activity tiers, with short Serbian (ti-form) descriptions. */
export const ACTIVITY_LEVEL_OPTIONS: {
  value: ActivityLevel;
  label: string;
  description: string;
}[] = [
  {
    value: "sedentary",
    label: "Sedentaran",
    description: "Malo ili nimalo vežbanja, pretežno sedenje.",
  },
  {
    value: "light",
    label: "Lagana aktivnost",
    description: "Lagane aktivnosti ili vežbanje 1-3x nedeljno.",
  },
  {
    value: "moderate",
    label: "Umerena aktivnost",
    description: "Umereno vežbanje 3-5x nedeljno.",
  },
  {
    value: "active",
    label: "Aktivan",
    description: "Intenzivno vežbanje 6-7x nedeljno.",
  },
  {
    value: "very_active",
    label: "Veoma aktivan",
    description: "Fizički posao ili trening dva puta dnevno.",
  },
];

/** The route the finished wizard hands its collected data off to (F016). */
export const ONBOARDING_SUMMARY_PATH = "/onboarding/pregled";

/** Query-param keys used to carry the collected data to `ONBOARDING_SUMMARY_PATH`. */
export const ONBOARDING_QUERY_KEYS = {
  name: "ime",
  sex: "pol",
  ageYears: "godine",
  heightCm: "visina",
  weightKg: "tezina",
  activityLevel: "aktivnost",
  goal: "cilj",
  targetWeightKg: "ciljnaTezina",
  timeframeWeeks: "nedelje",
} as const;

/** Builds the `?pol=...&godine=...` query string the plan-reveal page reads.
 * Target weight + timeframe are only carried for weight-change goals; for
 * maintain/tone they're irrelevant and omitted. */
export function buildOnboardingSummaryUrl(data: OnboardingData): string {
  const params = new URLSearchParams();
  if (data.name && data.name.trim() !== "")
    params.set(ONBOARDING_QUERY_KEYS.name, data.name.trim());
  if (data.sex) params.set(ONBOARDING_QUERY_KEYS.sex, data.sex);
  if (data.ageYears !== null)
    params.set(ONBOARDING_QUERY_KEYS.ageYears, String(data.ageYears));
  if (data.heightCm !== null)
    params.set(ONBOARDING_QUERY_KEYS.heightCm, String(data.heightCm));
  if (data.weightKg !== null)
    params.set(ONBOARDING_QUERY_KEYS.weightKg, String(data.weightKg));
  if (data.activityLevel)
    params.set(ONBOARDING_QUERY_KEYS.activityLevel, data.activityLevel);
  if (data.goal) params.set(ONBOARDING_QUERY_KEYS.goal, data.goal);

  const needsTarget =
    data.goal !== null && WEIGHT_CHANGE_GOALS.includes(data.goal);
  if (needsTarget && data.targetWeightKg !== null)
    params.set(
      ONBOARDING_QUERY_KEYS.targetWeightKg,
      String(data.targetWeightKg)
    );
  if (needsTarget && data.timeframeWeeks !== null)
    params.set(
      ONBOARDING_QUERY_KEYS.timeframeWeeks,
      String(data.timeframeWeeks)
    );

  return `${ONBOARDING_SUMMARY_PATH}?${params.toString()}`;
}
