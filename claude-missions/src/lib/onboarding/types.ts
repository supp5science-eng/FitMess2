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

import type { ActivityLevel, Sex } from "@/lib/types/db";

export type { ActivityLevel, Sex };

export interface OnboardingData {
  sex: Sex | null;
  ageYears: number | null;
  heightCm: number | null;
  weightKg: number | null;
  activityLevel: ActivityLevel | null;
  targetWeightKg: number | null;
  timeframeWeeks: number | null;
}

export const EMPTY_ONBOARDING_DATA: OnboardingData = {
  sex: null,
  ageYears: null,
  heightCm: null,
  weightKg: null,
  activityLevel: null,
  targetWeightKg: null,
  timeframeWeeks: null,
};

/** One question per screen, in the order the clarified spec lists them. */
export const ONBOARDING_STEP_IDS = [
  "pol",
  "godine",
  "visina",
  "tezina",
  "aktivnost",
  "cilj",
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEP_IDS)[number];

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
  sex: "pol",
  ageYears: "godine",
  heightCm: "visina",
  weightKg: "tezina",
  activityLevel: "aktivnost",
  targetWeightKg: "ciljnaTezina",
  timeframeWeeks: "nedelje",
} as const;

/** Builds the `?pol=...&godine=...` query string F016's summary page reads. */
export function buildOnboardingSummaryUrl(data: OnboardingData): string {
  const params = new URLSearchParams();
  if (data.sex) params.set(ONBOARDING_QUERY_KEYS.sex, data.sex);
  if (data.ageYears !== null)
    params.set(ONBOARDING_QUERY_KEYS.ageYears, String(data.ageYears));
  if (data.heightCm !== null)
    params.set(ONBOARDING_QUERY_KEYS.heightCm, String(data.heightCm));
  if (data.weightKg !== null)
    params.set(ONBOARDING_QUERY_KEYS.weightKg, String(data.weightKg));
  if (data.activityLevel)
    params.set(ONBOARDING_QUERY_KEYS.activityLevel, data.activityLevel);
  if (data.targetWeightKg !== null)
    params.set(
      ONBOARDING_QUERY_KEYS.targetWeightKg,
      String(data.targetWeightKg)
    );
  if (data.timeframeWeeks !== null)
    params.set(
      ONBOARDING_QUERY_KEYS.timeframeWeeks,
      String(data.timeframeWeeks)
    );

  return `${ONBOARDING_SUMMARY_PATH}?${params.toString()}`;
}
