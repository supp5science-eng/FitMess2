/**
 * F017: eating-rule template catalog + deterministic generation (AS-028) +
 * the shapes/validation the settings screen (`/profil/pravila`, AS-029)
 * toggles and edits.
 *
 * Pure, side-effect-free, framework-free (same shape as
 * `src/lib/budget/engine.ts` / `src/lib/onboarding/validation.ts`) --
 * `generateRules` never touches the network or the database; callers
 * (`src/lib/onboarding/persist.ts` at onboarding completion, and the
 * `/profil/pravila` "regenerate" action) are responsible for persisting the
 * result.
 *
 * Selection is a fixed catalog + eligibility rules, not randomness: the same
 * profile inputs always produce the same rules, and every profile gets
 * between 3 and 5 rules (AS-028's "3-5 Serbian rules"), never more, never
 * fewer -- see `generateRules`' doc comment for the exact algorithm.
 */

import { z } from "zod";

import type { ActivityLevel, Sex } from "@/lib/types/db";

export type { ActivityLevel, Sex };

// ---------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------

/** A catalog entry once selected for a user -- what `generateRules` returns. */
export interface RuleTemplate {
  id: string;
  textSr: string;
}

/** What actually gets persisted (`profiles.rules` jsonb array, F017 migration) --
 * a `RuleTemplate` plus the user's on/off toggle state (AS-029). */
export interface PersistedRule extends RuleTemplate {
  enabled: boolean;
}

/** Max length for a rule's (possibly user-edited) Serbian text (AS-029). */
export const MAX_RULE_TEXT_LENGTH = 140;

/** Zod schema for a single persisted rule -- used both to validate a
 * user's edit (AS-029: "edit them") before writing, and as documentation of
 * the exact jsonb shape `supabase/migrations/0003_eating_rules.sql` stores. */
export const persistedRuleSchema = z.object({
  id: z.string().min(1),
  textSr: z.string().trim().min(1).max(MAX_RULE_TEXT_LENGTH),
  enabled: z.boolean(),
});

/** A user's whole rule set never exceeds the 5-rule generation cap by more
 * than a small margin even after edits; 20 is a generous, still-sane upper
 * bound against a malformed/oversized payload. */
export const persistedRulesArraySchema = z.array(persistedRuleSchema).max(20);

/** Inline Serbian validation for a single rule's edited text (AS-029),
 * mirrors the `{valid, error}` shape `src/lib/onboarding/validation.ts` uses. */
export function validateRuleText(
  text: string
): { valid: true } | { valid: false; error: string } {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: "Pravilo ne sme biti prazno." };
  }
  if (trimmed.length > MAX_RULE_TEXT_LENGTH) {
    return {
      valid: false,
      error: `Pravilo je predugačko (najviše ${MAX_RULE_TEXT_LENGTH} karaktera).`,
    };
  }
  return { valid: true };
}

// ---------------------------------------------------------------------
// Rule catalog
// ---------------------------------------------------------------------

export interface RuleGenerationInput {
  sex: Sex;
  activityLevel: ActivityLevel;
  /** currentWeightKg - targetWeightKg; > 0 means a fat-loss goal. */
  weightDeltaKg: number;
  timeframeWeeks: number;
  /** Final clamped daily kcal target (post goal-adjust), from F014's
   * `planGoalAdjustment`. */
  dailyKcal: number;
  /** True when F014's `macroTargets` had to clamp fat/carbs because the
   * kcal budget was tight (see `engine.ts`'s `MacroTargets.clamped`). */
  macrosClamped: boolean;
  /** True when F014's `planGoalAdjustment` had to cap the deficit or apply
   * the kcal floor (see `engine.ts`'s `GoalAdjustmentResult.adjusted`). */
  goalAdjusted: boolean;
}

interface CatalogEntry extends RuleTemplate {
  /** Universal rules everyone benefits from -- used as the guaranteed
   * baseline and as padding to reach the 3-rule minimum. */
  isCore: boolean;
  eligible: (input: RuleGenerationInput) => boolean;
}

/**
 * The full Serbian (ti-form) rule catalog. Order matters: it's the
 * deterministic priority `generateRules` walks in both the "core anchor"
 * and "conditional match" passes.
 */
const RULE_CATALOG: CatalogEntry[] = [
  {
    id: "protein-2-obroka",
    textSr: "Unesi protein u bar 2 obroka svaki dan.",
    isCore: true,
    eligible: () => true,
  },
  {
    id: "povrce-svaki-dan",
    textSr: "Jedi povrće svaki dan, po mogućstvu u svakom obroku.",
    isCore: true,
    eligible: () => true,
  },
  {
    id: "voda-pre-obroka",
    textSr: "Popij čašu vode pre svakog obroka.",
    isCore: true,
    eligible: () => true,
  },
  {
    id: "voce-2-komada",
    textSr: "Pojedi bar 2 komada voća dnevno.",
    isCore: true,
    eligible: () => true,
  },
  {
    id: "jedenje-bez-telefona",
    textSr: "Jedi bez telefona bar jedan obrok dnevno.",
    isCore: true,
    eligible: () => true,
  },
  {
    id: "vlakna-fokus",
    textSr:
      "Uključi izvor vlakana (ovas, mahunarke, integralne žitarice) bar jednom dnevno.",
    isCore: false,
    eligible: (input) =>
      input.macrosClamped ||
      input.activityLevel === "sedentary" ||
      input.activityLevel === "light",
  },
  {
    id: "bez-tecnih-kalorija",
    textSr: "Izbegavaj tečne kalorije (sokovi, gazirana pića) van obroka.",
    isCore: false,
    eligible: (input) => input.goalAdjusted || input.dailyKcal < 1700,
  },
  {
    id: "protein-posle-treninga",
    textSr: "Pojačaj unos proteina posle treninga.",
    isCore: false,
    eligible: (input) =>
      input.activityLevel === "active" || input.activityLevel === "very_active",
  },
  {
    id: "kuvanje-kod-kuce",
    textSr: "Skuvaj bar 5 obroka kod kuće ove nedelje.",
    isCore: false,
    eligible: (input) =>
      input.activityLevel === "sedentary" || input.activityLevel === "light",
  },
  {
    id: "hidratacija-aktivnih",
    textSr: "Popij bar 2 litra vode dnevno.",
    isCore: false,
    eligible: (input) =>
      input.activityLevel === "active" || input.activityLevel === "very_active",
  },
  {
    id: "postepen-tempo",
    textSr: "Ne žuri -- postepen tempo je lakši za održati na duže staze.",
    isCore: false,
    eligible: (input) => input.timeframeWeeks >= 16,
  },
  {
    id: "planiranje-obroka",
    textSr: "Isplaniraj obroke za sutra veče pre spavanja.",
    isCore: false,
    eligible: (input) => input.weightDeltaKg >= 8,
  },
];

/** Minimum/maximum rule-set size (AS-028: "3-5 Serbian rules"). */
export const MIN_GENERATED_RULES = 3;
export const MAX_GENERATED_RULES = 5;

/**
 * Deterministically picks between `MIN_GENERATED_RULES` and
 * `MAX_GENERATED_RULES` rules for a profile:
 *
 *  1. Always start with the first two universal "anchor" rules (protein +
 *     povrće) -- every profile gets these, so the set is never empty or
 *     purely conditional.
 *  2. Walk the catalog's conditional (non-core) entries in order, adding
 *     every one whose `eligible(input)` matches the given profile, until
 *     the 5-rule cap is hit.
 *  3. If fewer than 3 rules were selected (a profile that matched no
 *     conditional rules), pad with the remaining universal rules (voda,
 *     voće, jedenje-bez-telefona) in catalog order until the 3-rule
 *     minimum is reached.
 *
 * Same input -> same output, always -- no randomness, no wall-clock reads.
 */
export function generateRules(input: RuleGenerationInput): RuleTemplate[] {
  const anchors = RULE_CATALOG.filter((entry) => entry.isCore);
  const conditional = RULE_CATALOG.filter(
    (entry) => !entry.isCore && entry.eligible(input)
  );

  const selected: CatalogEntry[] = [];
  const seenIds = new Set<string>();

  function add(entry: CatalogEntry | undefined): void {
    if (!entry || seenIds.has(entry.id)) return;
    seenIds.add(entry.id);
    selected.push(entry);
  }

  add(anchors[0]);
  add(anchors[1]);

  for (const entry of conditional) {
    if (selected.length >= MAX_GENERATED_RULES) break;
    add(entry);
  }

  let anchorIndex = 2;
  while (selected.length < MIN_GENERATED_RULES && anchorIndex < anchors.length) {
    add(anchors[anchorIndex]);
    anchorIndex += 1;
  }

  return selected
    .slice(0, MAX_GENERATED_RULES)
    .map(({ id, textSr }) => ({ id, textSr }));
}

/** Turns freshly-generated templates into the persisted shape -- every
 * newly generated rule starts enabled (AS-028: a user sees a ready-to-use
 * set they can then turn off on `/profil/pravila`, AS-029). */
export function toPersistedRules(templates: RuleTemplate[]): PersistedRule[] {
  return templates.map((template) => ({ ...template, enabled: true }));
}

// ---------------------------------------------------------------------
// Optional, non-binding day-structure guidance
// ---------------------------------------------------------------------

export interface DayStructureGuidance {
  breakfastKcal: number;
  lunchKcal: number;
  snackKcal: number;
  dinnerKcal: number;
}

/**
 * Splits a daily kcal budget into an illustrative breakfast/lunch/snack/
 * dinner guide (25% / 35% / 10% / remainder). Purely a suggestion the UI
 * must present as non-binding guidance, never an obligation (clarified
 * spec) -- there is no "obrok" logging feature tied to this split, it is
 * shown for orientation only.
 */
export function suggestedDayStructure(dailyKcal: number): DayStructureGuidance {
  const kcal = Math.max(0, Math.round(dailyKcal));
  const breakfastKcal = Math.round(kcal * 0.25);
  const lunchKcal = Math.round(kcal * 0.35);
  const snackKcal = Math.round(kcal * 0.1);
  // Dinner absorbs the rounding remainder so the four parts always sum to
  // exactly `kcal`, never drift by a stray kcal or two.
  const dinnerKcal = Math.max(0, kcal - breakfastKcal - lunchKcal - snackKcal);

  return { breakfastKcal, lunchKcal, snackKcal, dinnerKcal };
}
