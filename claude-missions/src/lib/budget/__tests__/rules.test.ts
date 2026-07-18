import { describe, expect, it } from "vitest";

import {
  MAX_GENERATED_RULES,
  MAX_RULE_TEXT_LENGTH,
  MIN_GENERATED_RULES,
  generateRules,
  persistedRuleSchema,
  persistedRulesArraySchema,
  suggestedDayStructure,
  toPersistedRules,
  validateRuleText,
} from "../rules";
import type { RuleGenerationInput } from "../rules";

// F017: pure unit coverage for the eating-rule catalog + generation
// algorithm (AS-028), the persisted-rule validation used by the settings
// screen (AS-029), and the optional day-structure guidance helper. The live
// "onboarding completion actually writes 3-5 rules to the real profiles
// row" proof lives in
// `src/lib/onboarding/__tests__/persist-rules.integration.test.ts`.

const SEDENTARY_MAINTENANCE: RuleGenerationInput = {
  sex: "female",
  activityLevel: "sedentary",
  weightDeltaKg: 0,
  timeframeWeeks: 4,
  dailyKcal: 1900,
  macrosClamped: false,
  goalAdjusted: false,
};

const ACTIVE_AGGRESSIVE_CUT: RuleGenerationInput = {
  sex: "male",
  activityLevel: "very_active",
  weightDeltaKg: 12,
  timeframeWeeks: 20,
  dailyKcal: 1450,
  macrosClamped: true,
  goalAdjusted: true,
};

describe("generateRules: AS-028 -- 3-5 Serbian rules generated based on profile", () => {
  it("test_AS_028_generates_between_3_and_5_rules_for_a_low_activity_maintenance_profile", () => {
    const rules = generateRules(SEDENTARY_MAINTENANCE);

    expect(rules.length).toBeGreaterThanOrEqual(MIN_GENERATED_RULES);
    expect(rules.length).toBeLessThanOrEqual(MAX_GENERATED_RULES);
  });

  it("test_AS_028_generates_between_3_and_5_rules_for_an_active_aggressive_cut_profile", () => {
    const rules = generateRules(ACTIVE_AGGRESSIVE_CUT);

    expect(rules.length).toBeGreaterThanOrEqual(MIN_GENERATED_RULES);
    expect(rules.length).toBeLessThanOrEqual(MAX_GENERATED_RULES);
  });

  it("test_AS_028_every_generated_rule_has_non_empty_serbian_text_and_a_stable_id", () => {
    const rules = generateRules(ACTIVE_AGGRESSIVE_CUT);

    for (const rule of rules) {
      expect(rule.id.length).toBeGreaterThan(0);
      expect(rule.textSr.trim().length).toBeGreaterThan(0);
      // Serbian ti-form eating-rule copy shouldn't contain any English
      // placeholder text -- a cheap sanity check the catalog is actually
      // localized, not a full linguistic assertion.
      expect(rule.textSr).not.toMatch(/lorem|placeholder|TODO/i);
    }
  });

  it("test_AS_028_generated_rules_have_no_duplicate_ids", () => {
    const rules = generateRules(ACTIVE_AGGRESSIVE_CUT);
    const ids = rules.map((rule) => rule.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("test_AS_028_selection_is_deterministic_for_the_same_profile_input", () => {
    const first = generateRules(ACTIVE_AGGRESSIVE_CUT);
    const second = generateRules(ACTIVE_AGGRESSIVE_CUT);

    expect(second).toEqual(first);
  });

  it("test_AS_028_a_more_demanding_profile_picks_up_profile_specific_rules_a_baseline_profile_does_not", () => {
    const baseline = generateRules(SEDENTARY_MAINTENANCE);
    const active = generateRules(ACTIVE_AGGRESSIVE_CUT);

    const baselineIds = new Set(baseline.map((rule) => rule.id));
    const activeIds = new Set(active.map((rule) => rule.id));

    // The active/aggressive-cut profile should surface at least one
    // activity- or deficit-specific rule the sedentary/maintenance profile
    // does not get -- proof the generator actually reads the profile, not
    // just returning a fixed list regardless of input.
    const activeOnly = [...activeIds].filter((id) => !baselineIds.has(id));
    expect(activeOnly.length).toBeGreaterThan(0);
  });

  it("test_AS_028_a_sedentary_profile_always_includes_the_two_universal_anchor_rules", () => {
    const rules = generateRules(SEDENTARY_MAINTENANCE);
    const ids = rules.map((rule) => rule.id);

    expect(ids).toContain("protein-2-obroka");
    expect(ids).toContain("povrce-svaki-dan");
  });

  it("test_AS_028_never_exceeds_the_5_rule_cap_even_when_many_conditions_match", () => {
    const rules = generateRules(ACTIVE_AGGRESSIVE_CUT);
    expect(rules.length).toBeLessThanOrEqual(5);
  });

  it("test_AS_028_never_produces_fewer_than_3_rules_even_for_a_profile_matching_zero_conditions", () => {
    const noConditionsMatch: RuleGenerationInput = {
      sex: "male",
      activityLevel: "moderate",
      weightDeltaKg: 0,
      timeframeWeeks: 4,
      dailyKcal: 2200,
      macrosClamped: false,
      goalAdjusted: false,
    };

    const rules = generateRules(noConditionsMatch);
    expect(rules.length).toBeGreaterThanOrEqual(3);
  });
});

describe("toPersistedRules: default toggle state", () => {
  it("test_AS_028_every_freshly_generated_rule_starts_enabled", () => {
    const templates = generateRules(SEDENTARY_MAINTENANCE);
    const persisted = toPersistedRules(templates);

    expect(persisted.length).toBe(templates.length);
    for (const rule of persisted) {
      expect(rule.enabled).toBe(true);
    }
  });
});

describe("validateRuleText: AS-029 inline Serbian edit validation", () => {
  it("test_AS_029_rejects_empty_text", () => {
    const result = validateRuleText("   ");
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error.length).toBeGreaterThan(0);
  });

  it("test_AS_029_rejects_text_over_the_max_length", () => {
    const result = validateRuleText("a".repeat(MAX_RULE_TEXT_LENGTH + 1));
    expect(result.valid).toBe(false);
  });

  it("test_AS_029_accepts_reasonable_edited_text", () => {
    const result = validateRuleText("Pij vodu pre svakog obroka i posle treninga.");
    expect(result.valid).toBe(true);
  });
});

describe("persistedRuleSchema / persistedRulesArraySchema: AS-029 write-path validation", () => {
  it("test_AS_029_accepts_a_well_formed_rule_array", () => {
    const parsed = persistedRulesArraySchema.safeParse([
      { id: "protein-2-obroka", textSr: "Unesi protein u bar 2 obroka.", enabled: true },
      { id: "povrce-svaki-dan", textSr: "Jedi povrće svaki dan.", enabled: false },
    ]);
    expect(parsed.success).toBe(true);
  });

  it("test_AS_029_rejects_a_rule_with_empty_text", () => {
    const parsed = persistedRuleSchema.safeParse({ id: "x", textSr: "", enabled: true });
    expect(parsed.success).toBe(false);
  });

  it("test_AS_029_rejects_a_rule_missing_the_enabled_flag", () => {
    const parsed = persistedRuleSchema.safeParse({ id: "x", textSr: "Nešto" });
    expect(parsed.success).toBe(false);
  });
});

describe("suggestedDayStructure: optional, non-binding guidance", () => {
  it("test_suggested_day_structure_splits_kcal_into_four_positive_parts_summing_to_the_total", () => {
    const structure = suggestedDayStructure(2000);

    expect(structure.breakfastKcal).toBeGreaterThan(0);
    expect(structure.lunchKcal).toBeGreaterThan(0);
    expect(structure.snackKcal).toBeGreaterThan(0);
    expect(structure.dinnerKcal).toBeGreaterThan(0);

    const sum =
      structure.breakfastKcal +
      structure.lunchKcal +
      structure.snackKcal +
      structure.dinnerKcal;
    expect(sum).toBe(2000);
  });

  it("test_suggested_day_structure_never_goes_negative_for_a_zero_or_negative_kcal_input", () => {
    const structure = suggestedDayStructure(-100);

    expect(structure.breakfastKcal).toBeGreaterThanOrEqual(0);
    expect(structure.lunchKcal).toBeGreaterThanOrEqual(0);
    expect(structure.snackKcal).toBeGreaterThanOrEqual(0);
    expect(structure.dinnerKcal).toBeGreaterThanOrEqual(0);
  });
});
