/**
 * Trening: what a logged session actually costs.
 *
 * Pure, DB-free arithmetic (money-math rule) -- the catalog of activities plus
 * the one formula that prices them. Nothing here reads the database and
 * nothing here touches the calorie budget.
 *
 * --- WHY THIS NEVER ADDS TO THE BUDGET -------------------------------------
 *
 * The number this module produces is shown to the user and stored on the
 * workout row. It does NOT become extra food allowance, and no caller may make
 * it so. The plan already pays for training: `TDEE = BMR x ACTIVITY_MULTIPLIER`
 * (`src/lib/budget/engine.ts`), and `moderate` = 1.55 is defined as "3-5
 * workouts a week" -- roughly 1000 kcal/day of movement for an 85 kg body
 * already baked into the target. Adding a logged session on top would pay for
 * it twice, which is the single most common way a calorie app quietly makes
 * its users gain weight.
 *
 * When someone genuinely trains more than their level assumes, the correction
 * comes from the SCALE (Nedeljno merenje, `src/lib/weight/weekly-trend.ts`),
 * which measures their real TDEE instead of guessing it from a MET table.
 *
 * --- THE MODEL -------------------------------------------------------------
 *
 * The standard compendium model (Ainsworth et al., Compendium of Physical
 * Activities, 2011), kept NET of resting metabolism -- exactly the same
 * treatment `briskWalkKcalPerMin` in `src/lib/home/adaptive.ts` gives the
 * walking suggestion, and for the same reason: an hour of training only counts
 * for what it burns ABOVE the hour of sitting it replaced. Counting gross
 * would double-count the resting hour the BMR line already includes.
 *
 *   net MET  = MET - 1          (1 MET = lying/sitting at rest)
 *   kcal/min = net MET x 3.5 x kg / 200
 *
 * The 1-MET subtraction is also what keeps the "mirovanje + trening" breakdown
 * on the Trening screen honest: BMR covers all 24 hours INCLUDING the hour
 * spent training, so only the surplus may be added to it.
 *
 * A note on precision, so nobody "fixes" it later: 1 MET (~1 kcal/kg/h) runs
 * roughly 10% above a Mifflin-St Jeor BMR for a typical adult, so the
 * subtraction is very slightly generous. That is deliberate -- the alternative
 * (deriving each person's own resting rate per minute) would be false
 * precision on top of MET values that are population averages with wide
 * individual spread. These figures are good to about +/-20% for any one
 * person, which is why they are shown as a record of effort and never spent as
 * allowance.
 */

import type { WorkoutIntensity } from "@/lib/types/db";

/** The three intensity levels, in the order the UI offers them. */
export const WORKOUT_INTENSITIES: readonly WorkoutIntensity[] = [
  "lako",
  "srednje",
  "jako",
];

/**
 * Stand-in mass when the profile has none. Onboarding always asks for weight,
 * so this is defensive only. Deliberately mid-range rather than high: guessing
 * heavy would inflate every number on the screen.
 * (Matches `FALLBACK_WEIGHT_KG` in `src/lib/home/adaptive.ts`.)
 */
export const FALLBACK_WEIGHT_KG = 70;

/** Bounds on a single session, mirrored by the DB check constraint (0026). */
export const MIN_WORKOUT_MINUTES = 1;
export const MAX_WORKOUT_MINUTES = 600;

export interface WorkoutActivity {
  /** Stored in `workouts.activity_key`. Stable -- renaming one rewrites history. */
  key: string;
  /** i18n key for the display name (`workout.activity.<key>`). */
  labelKey: string;
  emoji: string;
  /**
   * GROSS MET per intensity (Ainsworth 2011). Net (what we actually charge) is
   * this minus 1 -- see the module header.
   */
  mets: Record<WorkoutIntensity, number>;
  /** What the minutes field starts at when this activity is picked. */
  defaultMinutes: number;
}

/**
 * The catalog. Ordered by how often people log them, not alphabetically: the
 * first six cover the overwhelming majority of sessions, so the common case is
 * visible without scrolling.
 *
 * Adding an activity is a one-line change here -- `workouts.activity_key` is
 * deliberately free text rather than a Postgres enum, so a new sport needs no
 * migration. Removing one is NOT free: existing rows keep the old key, so
 * deleted keys must stay resolvable (see `findActivity`).
 */
export const WORKOUT_ACTIVITIES: readonly WorkoutActivity[] = [
  {
    key: "teretana",
    labelKey: "workout.activity.teretana",
    emoji: "🏋️",
    // Resistance training: 3.5 (light effort) / 5.0 (general) / 6.0 (vigorous).
    mets: { lako: 3.5, srednje: 5.0, jako: 6.0 },
    defaultMinutes: 60,
  },
  {
    key: "hodanje",
    labelKey: "workout.activity.hodanje",
    emoji: "🚶",
    // 4.0 / 5.6 / 6.4 km/h. The middle value is the same 4.3 MET brisk walk
    // the adaptive plan prices its walking suggestion with -- the two must
    // never quote different numbers for the same walk.
    mets: { lako: 3.0, srednje: 4.3, jako: 5.0 },
    defaultMinutes: 30,
  },
  {
    key: "trcanje",
    labelKey: "workout.activity.trcanje",
    emoji: "🏃",
    // ~8 / ~11 / ~13 km/h.
    mets: { lako: 7.0, srednje: 9.8, jako: 11.8 },
    defaultMinutes: 30,
  },
  {
    key: "bicikl",
    labelKey: "workout.activity.bicikl",
    emoji: "🚴",
    // 16-19 / 19-22 / 22-25 km/h.
    mets: { lako: 5.8, srednje: 8.0, jako: 10.0 },
    defaultMinutes: 45,
  },
  {
    key: "kod-kuce",
    labelKey: "workout.activity.kodKuce",
    emoji: "🤸",
    // Calisthenics: light / general / vigorous.
    mets: { lako: 3.8, srednje: 5.0, jako: 8.0 },
    defaultMinutes: 30,
  },
  {
    key: "sipke",
    labelKey: "workout.activity.sipke",
    emoji: "🧗",
    // Street workout (bars). Compendium 02054 puts vigorous calisthenics
    // (pull-ups, push-ups, dips) at 8.0, but that is the MET of the WORK --
    // and a bar session, like a gym session, is mostly sets separated by rest,
    // while the user logs the whole time they were out there. Priced for the
    // SESSION instead: a little above `kod-kuce` (bodyweight against gravity
    // costs more than general home calisthenics) and a little above `teretana`
    // (less standing around between sets), with the hard end reaching toward
    // the compendium's continuous-effort figure.
    mets: { lako: 4.0, srednje: 5.5, jako: 7.5 },
    defaultMinutes: 45,
  },
  {
    key: "hiit",
    labelKey: "workout.activity.hiit",
    emoji: "⚡",
    mets: { lako: 6.0, srednje: 8.0, jako: 10.0 },
    defaultMinutes: 20,
  },
  {
    key: "fudbal",
    labelKey: "workout.activity.fudbal",
    emoji: "⚽",
    // Casual / general / competitive.
    mets: { lako: 7.0, srednje: 8.0, jako: 10.0 },
    defaultMinutes: 60,
  },
  {
    key: "kosarka",
    labelKey: "workout.activity.kosarka",
    emoji: "🏀",
    mets: { lako: 4.5, srednje: 6.5, jako: 8.0 },
    defaultMinutes: 60,
  },
  {
    key: "tenis",
    labelKey: "workout.activity.tenis",
    emoji: "🎾",
    // Doubles / general / singles.
    mets: { lako: 5.0, srednje: 7.3, jako: 8.0 },
    defaultMinutes: 60,
  },
  {
    key: "odbojka",
    labelKey: "workout.activity.odbojka",
    emoji: "🏐",
    mets: { lako: 3.0, srednje: 4.0, jako: 6.0 },
    defaultMinutes: 60,
  },
  {
    key: "plivanje",
    labelKey: "workout.activity.plivanje",
    emoji: "🏊",
    mets: { lako: 5.3, srednje: 7.0, jako: 9.8 },
    defaultMinutes: 45,
  },
  {
    key: "borilacki",
    labelKey: "workout.activity.borilacki",
    emoji: "🥊",
    mets: { lako: 5.3, srednje: 8.0, jako: 10.3 },
    defaultMinutes: 60,
  },
  {
    key: "grupni",
    labelKey: "workout.activity.grupni",
    emoji: "💃",
    // Aerobics / dance class: low impact / general / high impact.
    mets: { lako: 5.0, srednje: 6.5, jako: 7.3 },
    defaultMinutes: 45,
  },
  {
    key: "joga",
    labelKey: "workout.activity.joga",
    emoji: "🧘",
    // Hatha / general / power. The lightest thing in the catalog -- at 2.5 MET
    // gross it nets 1.5, which is the honest answer, not a rounding error.
    mets: { lako: 2.5, srednje: 3.0, jako: 4.0 },
    defaultMinutes: 45,
  },
  {
    key: "planinarenje",
    labelKey: "workout.activity.planinarenje",
    emoji: "🥾",
    mets: { lako: 5.3, srednje: 6.0, jako: 7.8 },
    defaultMinutes: 90,
  },
  {
    key: "veslanje",
    labelKey: "workout.activity.veslanje",
    emoji: "🚣",
    mets: { lako: 4.8, srednje: 7.0, jako: 8.5 },
    defaultMinutes: 30,
  },
  {
    key: "fizicki-posao",
    labelKey: "workout.activity.fizickiPosao",
    emoji: "🔨",
    // Not a workout, but it is movement the day genuinely contains, and the
    // user asked to be able to write down "everything".
    mets: { lako: 3.0, srednje: 4.5, jako: 6.0 },
    defaultMinutes: 120,
  },
  {
    key: "ostalo",
    labelKey: "workout.activity.ostalo",
    emoji: "🏅",
    // The escape hatch, priced at moderate general-exercise values so an
    // unnamed sport still lands in a sane place rather than at zero.
    mets: { lako: 3.5, srednje: 5.0, jako: 7.0 },
    defaultMinutes: 45,
  },
];

/**
 * The activity for a stored key, or `null` when the key predates/outlives the
 * catalog. Callers must render `null` under a neutral label rather than
 * dropping the row -- a workout the user logged does not stop having happened
 * because we renamed something.
 */
export function findActivity(key: string): WorkoutActivity | null {
  return WORKOUT_ACTIVITIES.find((activity) => activity.key === key) ?? null;
}

/** Net MET (above rest) for an activity at a given intensity, never below 0. */
export function netMets(
  activity: WorkoutActivity,
  intensity: WorkoutIntensity
): number {
  return Math.max(0, activity.mets[intensity] - 1);
}

/**
 * NET kcal burned by `minutes` of `activityKey` at `intensity`, for a body of
 * `weightKg` -- i.e. what the session cost ABOVE resting. Rounded to a whole
 * kcal.
 *
 * An unknown activity key yields 0 rather than throwing: this runs on the save
 * path, and a catalog miss must cost the user a number, never their entry.
 */
export function workoutKcal({
  activityKey,
  intensity,
  minutes,
  weightKg,
}: {
  activityKey: string;
  intensity: WorkoutIntensity;
  minutes: number;
  weightKg?: number | null;
}): number {
  const activity = findActivity(activityKey);
  if (!activity) return 0;

  const kg = weightKg && weightKg > 0 ? weightKg : FALLBACK_WEIGHT_KG;
  const safeMinutes = Math.min(
    MAX_WORKOUT_MINUTES,
    Math.max(0, Math.round(minutes))
  );

  const kcalPerMin = (netMets(activity, intensity) * 3.5 * kg) / 200;
  return Math.round(kcalPerMin * safeMinutes);
}

/** Total net kcal across a day's sessions. */
export function totalWorkoutKcal(
  workouts: readonly { kcal: number }[]
): number {
  return workouts.reduce((sum, workout) => sum + Math.max(0, workout.kcal), 0);
}

/** Total minutes across a day's sessions. */
export function totalWorkoutMinutes(
  workouts: readonly { minutes: number }[]
): number {
  return workouts.reduce(
    (sum, workout) => sum + Math.max(0, workout.minutes),
    0
  );
}
