import { describe, expect, it } from "vitest";

import {
  ACTIVITY_MULTIPLIERS,
  DEFAULT_DEFICIT_PCT,
  FAT_G_PER_KG_MIN,
  KCAL_FLOOR,
  MAX_AGE_YEARS,
  MAX_DEFICIT_PCT,
  MAX_HEIGHT_CM,
  MAX_WEIGHT_KG,
  MIN_AGE_YEARS,
  MIN_HEIGHT_CM,
  MIN_WEIGHT_KG,
  PROTEIN_G_PER_KG,
  PROTEIN_G_PER_KG_MIN,
  bmr,
  dailyTarget,
  macroTargets,
  planForGoal,
  planGoalAdjustment,
  tdee,
  weeklyBudget,
} from "@/lib/budget/engine";

// F014: the deterministic budget engine. Pure arithmetic, no I/O -- see
// missions/20260717-183157/features/F014-budget-engine.md and
// clarifications/F014-clarification.md for the clarified spec this was
// built against.
//
// Reference values below are hand-computed directly from the published
// Mifflin-St Jeor equation (Mifflin et al., Am J Clin Nutr 1990;51:241-247)
// -- not derived by calling the implementation -- so they independently
// verify the formula is wired up correctly:
//   men:   BMR = 10*kg + 6.25*cm - 5*age + 5
//   women: BMR = 10*kg + 6.25*cm - 5*age - 161

describe("F014: bmr (AS-021)", () => {
  it("test_AS_021_male_reference_value_80kg_180cm_25y", () => {
    // 10*80 + 6.25*180 - 5*25 + 5 = 800 + 1125 - 125 + 5 = 1805
    expect(bmr("male", 80, 180, 25)).toBe(1805);
  });

  it("test_AS_021_female_reference_value_65kg_165cm_30y", () => {
    // 10*65 + 6.25*165 - 5*30 - 161 = 650 + 1031.25 - 150 - 161 = 1370.25 -> 1370
    expect(bmr("female", 65, 165, 30)).toBe(1370);
  });

  it("test_AS_021_male_reference_value_70kg_175cm_40y", () => {
    // 10*70 + 6.25*175 - 5*40 + 5 = 700 + 1093.75 - 200 + 5 = 1598.75 -> 1599
    expect(bmr("male", 70, 175, 40)).toBe(1599);
  });

  it("test_AS_021_female_reference_value_55kg_160cm_22y", () => {
    // 10*55 + 6.25*160 - 5*22 - 161 = 550 + 1000 - 110 - 161 = 1279
    expect(bmr("female", 55, 160, 22)).toBe(1279);
  });

  it("test_AS_021_same_body_stats_male_bmr_exceeds_female_bmr_by_166", () => {
    // The formula only differs by a constant (+5 vs -161), a 166 kcal gap,
    // for identical weight/height/age -- a cheap structural sanity check
    // independent of any single reference value.
    const male = bmr("male", 75, 170, 28);
    const female = bmr("female", 75, 170, 28);
    expect(male - female).toBe(166);
  });

  it("test_AS_021_zero_and_negative_inputs_clamp_to_the_minimum_bounds_instead_of_throwing", () => {
    // 10*30 + 6.25*100 - 5*13 + 5 = 300 + 625 - 65 + 5 = 865
    expect(bmr("male", 0, 0, 0)).toBe(865);
    expect(bmr("male", -10, -50, -5)).toBe(865);
    expect(Number.isNaN(bmr("male", 0, 0, 0))).toBe(false);
  });

  it("test_AS_021_extreme_high_inputs_clamp_to_the_maximum_bounds_instead_of_throwing", () => {
    // 10*300 + 6.25*250 - 5*100 + 5 = 3000 + 1562.5 - 500 + 5 = 4067.5 -> 4068
    expect(bmr("male", 1000, 500, 200)).toBe(4068);
    expect(bmr("male", MAX_WEIGHT_KG, MAX_HEIGHT_CM, MAX_AGE_YEARS)).toBe(
      4068
    );
  });

  it("test_AS_021_inputs_at_the_exact_clamp_boundaries_are_not_altered", () => {
    // Boundary values themselves (not beyond them) must pass through
    // unclamped -- proves the guard is min/max, not an overzealous clip.
    const atMin = bmr("female", MIN_WEIGHT_KG, MIN_HEIGHT_CM, MIN_AGE_YEARS);
    // 10*30 + 6.25*100 - 5*13 - 161 = 300 + 625 - 65 - 161 = 699
    expect(atMin).toBe(699);
  });
});

describe("F014: tdee (AS-022)", () => {
  // BMR fixed at a round 1500 kcal so each tier's math is easy to verify
  // independently against the published multiplier table.
  const b = 1500;

  it("test_AS_022_sedentary_multiplier_is_1_2", () => {
    expect(ACTIVITY_MULTIPLIERS.sedentary).toBe(1.2);
    expect(tdee(b, "sedentary")).toBe(1800); // 1500 * 1.2
  });

  it("test_AS_022_light_multiplier_is_1_375", () => {
    expect(ACTIVITY_MULTIPLIERS.light).toBe(1.375);
    expect(tdee(b, "light")).toBe(2063); // 1500 * 1.375 = 2062.5 -> 2063
  });

  it("test_AS_022_moderate_multiplier_is_1_55", () => {
    expect(ACTIVITY_MULTIPLIERS.moderate).toBe(1.55);
    expect(tdee(b, "moderate")).toBe(2325); // 1500 * 1.55
  });

  it("test_AS_022_active_multiplier_is_1_725", () => {
    expect(ACTIVITY_MULTIPLIERS.active).toBe(1.725);
    expect(tdee(b, "active")).toBe(2588); // 1500 * 1.725 = 2587.5 -> 2588
  });

  it("test_AS_022_very_active_multiplier_is_1_9", () => {
    expect(ACTIVITY_MULTIPLIERS.very_active).toBe(1.9);
    expect(tdee(b, "very_active")).toBe(2850); // 1500 * 1.9
  });

  it("test_AS_022_tdee_strictly_increases_with_each_higher_activity_tier", () => {
    const tiers = [
      "sedentary",
      "light",
      "moderate",
      "active",
      "very_active",
    ] as const;
    const values = tiers.map((t) => tdee(b, t));
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
  });

  it("test_AS_022_unrecognized_activity_level_falls_back_to_the_sedentary_multiplier_instead_of_throwing", () => {
    // Defensive branch: data could theoretically arrive from the DB as a
    // value outside the TypeScript union (e.g. an old/removed tier name).
    expect(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tdee(b, "not_a_real_tier" as any)
    ).not.toThrow();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(tdee(b, "not_a_real_tier" as any)).toBe(tdee(b, "sedentary"));
  });

  it("test_AS_022_zero_or_negative_bmr_clamps_to_zero_instead_of_going_negative", () => {
    expect(tdee(0, "moderate")).toBe(0);
    expect(tdee(-500, "moderate")).toBe(0);
  });
});

describe("F014: dailyTarget floors (AS-023)", () => {
  it("test_AS_023_never_below_1400_for_men_even_with_a_large_requested_deficit", () => {
    // TDEE=1800 (> the 1400 floor), 25% deficit -> raw 1350, under the floor,
    // so the floor wins -> 1400. (TDEE stays above the floor, so the separate
    // "floor never exceeds TDEE" cap doesn't apply here.)
    expect(dailyTarget(1800, "male", 0.25)).toBe(1400);
  });

  it("test_AS_023_never_below_1200_for_women_even_with_a_large_requested_deficit", () => {
    // TDEE=1500 (> the 1200 floor), 25% deficit -> raw 1125, under the floor.
    expect(dailyTarget(1500, "female", 0.25)).toBe(1200);
  });

  it("test_AS_023_value_exactly_at_the_male_floor_is_not_pushed_higher", () => {
    // TDEE=1750, 20% deficit -> raw = 1400 exactly = the floor.
    expect(dailyTarget(1750, "male", 0.2)).toBe(1400);
  });

  it("test_AS_023_value_exactly_at_the_female_floor_is_not_pushed_higher", () => {
    // TDEE=1500, 20% deficit -> raw = 1200 exactly = the floor.
    expect(dailyTarget(1500, "female", 0.2)).toBe(1200);
  });

  it("test_AS_023_value_comfortably_above_the_floor_is_left_unclamped", () => {
    // TDEE=3000, 20% deficit -> raw = 2400, nowhere near either floor.
    expect(dailyTarget(3000, "male")).toBe(2400);
    expect(dailyTarget(3000, "female")).toBe(2400);
  });

  it("test_AS_023_male_and_female_floors_differ_by_200_kcal", () => {
    expect(KCAL_FLOOR.male - KCAL_FLOOR.female).toBe(200);
  });
});

describe("F014: dailyTarget deficit cap (AS-024)", () => {
  it("test_AS_024_a_50_percent_requested_deficit_is_capped_to_25_percent", () => {
    // TDEE=3000: an uncapped 50% deficit would be 1500; capped at 25% it's
    // 2250, well above the male floor so the floor doesn't interfere.
    expect(dailyTarget(3000, "male", 0.5)).toBe(2250);
  });

  it("test_AS_024_exactly_25_percent_is_the_boundary_and_is_not_reduced_further", () => {
    expect(dailyTarget(2000, "male", MAX_DEFICIT_PCT)).toBe(1500); // 2000*0.75
  });

  it("test_AS_024_just_over_25_percent_is_clamped_down_to_the_25_percent_result", () => {
    expect(dailyTarget(2000, "male", 0.26)).toBe(
      dailyTarget(2000, "male", MAX_DEFICIT_PCT)
    );
  });

  it("test_AS_024_a_negative_requested_deficit_surplus_clamps_to_zero_deficit", () => {
    expect(dailyTarget(2000, "male", -0.3)).toBe(2000);
  });

  it("test_AS_024_default_deficit_used_when_no_deficit_argument_is_supplied", () => {
    expect(DEFAULT_DEFICIT_PCT).toBeLessThanOrEqual(MAX_DEFICIT_PCT);
    expect(dailyTarget(2500, "male")).toBe(
      dailyTarget(2500, "male", DEFAULT_DEFICIT_PCT)
    );
  });
});

describe("F014: macroTargets (AS-025)", () => {
  it("test_AS_025_protein_is_within_1_8_to_2_2_g_per_kg_under_a_comfortable_budget", () => {
    const result = macroTargets(80, 2400);
    const proteinPerKg = result.proteinG / 80;
    expect(proteinPerKg).toBeGreaterThanOrEqual(1.8);
    expect(proteinPerKg).toBeLessThanOrEqual(2.2);
    expect(result.proteinG).toBe(160); // PROTEIN_G_PER_KG (2.0) * 80
    expect(PROTEIN_G_PER_KG).toBeGreaterThanOrEqual(1.8);
    expect(PROTEIN_G_PER_KG).toBeLessThanOrEqual(2.2);
  });

  it("test_AS_025_fat_is_at_least_0_6_g_per_kg_under_a_comfortable_budget", () => {
    const result = macroTargets(80, 2400);
    expect(result.fatG / 80).toBeGreaterThanOrEqual(FAT_G_PER_KG_MIN);
    expect(result.clamped).toBe(false);
  });

  it("test_AS_025_carbs_are_exactly_the_remainder_of_calories_under_a_comfortable_budget", () => {
    // weight=80: protein 160g (640 kcal), fat 64g (576 kcal); remainder
    // 2400 - 640 - 576 = 1184 kcal -> 296g carbs @ 4 kcal/g.
    const result = macroTargets(80, 2400);
    expect(result.fatG).toBe(64);
    expect(result.carbsG).toBe(296);
    const totalKcal =
      result.proteinG * 4 + result.fatG * 9 + result.carbsG * 4;
    expect(totalKcal).toBe(2400);
  });

  it("test_AS_025_carbs_never_go_negative_when_the_budget_is_tighter_than_protein_plus_fat", () => {
    const result = macroTargets(80, 400); // deliberately far too low
    expect(result.carbsG).toBeGreaterThanOrEqual(0);
    expect(result.carbsG).toBe(0);
  });

  it("test_AS_025_tight_deficit_pulls_fat_toward_its_floor_and_flags_clamped", () => {
    // weight=100kg: default protein 200g (800 kcal), default fat 80g
    // (720 kcal) sums to 1520 kcal > the 1400 kcal male floor budget.
    const result = macroTargets(100, 1400);
    expect(result.clamped).toBe(true);
    expect(result.proteinG).toBe(200);
    // Fat floor = 0.6*100 = 60g; remaining budget after protein
    // (1400-800=600 kcal -> 66.7g) is above the floor, so fat lands at
    // the budget-derived value rather than being pinned to the floor.
    expect(result.fatG).toBe(66.7);
    expect(result.fatG).toBeGreaterThanOrEqual(60);
    expect(result.carbsG).toBe(0);
  });

  it("test_AS_025_when_protein_plus_floor_fat_still_exceeds_dailyKcal_fat_holds_floor_then_protein_walks_to_its_floor", () => {
    // weight=120kg, 1400 kcal: default protein 240g (960) + fat floor 72g
    // (648) = 1608 > 1400. Fat holds at its 72g floor; protein then gives way
    // toward its 1.6 g/kg floor (192g) so the split fits far closer to budget.
    const result = macroTargets(120, 1400);
    expect(result.clamped).toBe(true);
    expect(result.fatG).toBe(72); // fat pinned at its floor
    expect(result.proteinG).toBe(192); // protein walked down to its 1.6 g/kg floor
    expect(result.proteinG).toBeGreaterThanOrEqual(round1(120 * 1.6));
    expect(result.carbsG).toBe(0);
    // Only a tiny overshoot remains (both macros at their physiological floors).
    const totalKcal = result.proteinG * 4 + result.fatG * 9;
    expect(totalKcal).toBeLessThan(1608); // much tighter than the old fat-only clamp
  });

  it("test_AS_025_zero_or_negative_dailyKcal_does_not_throw_and_carbs_clamp_to_zero", () => {
    expect(() => macroTargets(70, 0)).not.toThrow();
    expect(() => macroTargets(70, -500)).not.toThrow();
    expect(macroTargets(70, 0).carbsG).toBe(0);
    expect(macroTargets(70, -500).carbsG).toBe(0);
  });

  it("test_AS_025_weight_inputs_clamp_to_safe_bounds_instead_of_producing_nonsense", () => {
    expect(() => macroTargets(0, 2000)).not.toThrow();
    const result = macroTargets(0, 2000);
    expect(result.proteinG).toBe(round1(MIN_WEIGHT_KG * PROTEIN_G_PER_KG));
  });
});

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

describe("F014: weeklyBudget (AS-026)", () => {
  it("test_AS_026_weekly_equals_daily_times_seven", () => {
    expect(weeklyBudget(2000)).toBe(14000);
    expect(weeklyBudget(1400)).toBe(9800);
    expect(weeklyBudget(1200)).toBe(8400);
  });

  it("test_AS_026_rounds_a_fractional_daily_value_to_the_nearest_kcal_before_multiplying", () => {
    expect(weeklyBudget(1999.6)).toBe(2000 * 7);
  });

  it("test_AS_026_zero_or_negative_daily_clamps_to_zero_instead_of_going_negative", () => {
    expect(weeklyBudget(0)).toBe(0);
    expect(weeklyBudget(-500)).toBe(0);
  });
});

describe("F014: planGoalAdjustment (AS-030)", () => {
  it("test_AS_030_a_goal_within_safe_bounds_is_not_adjusted", () => {
    // 5kg loss over 10 weeks (70 days): 5*7700/70 = 550 kcal/day deficit
    // implied; 550/2500 = 22%, under the 25% cap.
    const result = planGoalAdjustment({
      sex: "male",
      currentWeightKg: 90,
      targetWeightKg: 85,
      timeframeWeeks: 10,
      tdeeKcal: 2500,
    });
    expect(result.adjusted).toBe(false);
    expect(result.reasonCodes).toEqual([]);
    expect(result.dailyKcal).toBe(1950); // round(2500 * (1-0.22))
    expect(result.weeklyKcal).toBe(1950 * 7);
    expect(result.impliedDeficitPct).toBeCloseTo(0.22, 5);
  });

  it("test_AS_030_a_goal_exceeding_the_25_percent_cap_is_adjusted_with_that_reason_code", () => {
    // 10kg loss over 8 weeks (56 days): 10*7700/56 = 1375 kcal/day implied,
    // 1375/2600 = 52.9%, far over the cap.
    const result = planGoalAdjustment({
      sex: "male",
      currentWeightKg: 100,
      targetWeightKg: 90,
      timeframeWeeks: 8,
      tdeeKcal: 2600,
    });
    expect(result.adjusted).toBe(true);
    expect(result.reasonCodes).toEqual(["deficit_capped_25_percent"]);
    expect(result.dailyKcal).toBe(1950); // round(2600 * 0.75)
    expect(result.appliedDeficitPct).toBeCloseTo(0.25, 5);
    expect(result.impliedDeficitPct).toBeGreaterThan(MAX_DEFICIT_PCT);
  });

  it("test_AS_030_a_goal_that_hits_both_the_percent_cap_and_the_kcal_floor_reports_both_reason_codes", () => {
    // 10kg loss over 6 weeks (42 days) against a low 1500 kcal TDEE:
    // capped 25% deficit -> raw 1125 kcal, below the 1200 female floor.
    const result = planGoalAdjustment({
      sex: "female",
      currentWeightKg: 55,
      targetWeightKg: 45,
      timeframeWeeks: 6,
      tdeeKcal: 1500,
    });
    expect(result.adjusted).toBe(true);
    expect(result.reasonCodes).toEqual([
      "deficit_capped_25_percent",
      "floor_kcal_applied",
    ]);
    expect(result.dailyKcal).toBe(1200);
    expect(result.appliedDeficitPct).toBeCloseTo(0.2, 5); // 1 - 1200/1500
  });

  it("test_AS_030_a_maintenance_or_weight_gain_goal_implies_no_deficit_and_is_not_adjusted", () => {
    const result = planGoalAdjustment({
      sex: "male",
      currentWeightKg: 70,
      targetWeightKg: 75,
      timeframeWeeks: 10,
      tdeeKcal: 2200,
    });
    expect(result.adjusted).toBe(false);
    expect(result.reasonCodes).toEqual([]);
    expect(result.dailyKcal).toBe(2200);
    expect(result.impliedDeficitPct).toBe(0);
  });

  it("test_AS_030_equal_current_and_target_weight_is_treated_as_maintenance", () => {
    const result = planGoalAdjustment({
      sex: "female",
      currentWeightKg: 65,
      targetWeightKg: 65,
      timeframeWeeks: 4,
      tdeeKcal: 2000,
    });
    expect(result.adjusted).toBe(false);
    expect(result.dailyKcal).toBe(2000);
  });

  it("test_AS_030_a_zero_or_negative_timeframe_does_not_throw_and_is_treated_as_the_shortest_plan", () => {
    expect(() =>
      planGoalAdjustment({
        sex: "male",
        currentWeightKg: 80,
        targetWeightKg: 75,
        timeframeWeeks: 0,
        tdeeKcal: 2500,
      })
    ).not.toThrow();

    const zeroWeeks = planGoalAdjustment({
      sex: "male",
      currentWeightKg: 80,
      targetWeightKg: 75,
      timeframeWeeks: 0,
      tdeeKcal: 2500,
    });
    const negativeWeeks = planGoalAdjustment({
      sex: "male",
      currentWeightKg: 80,
      targetWeightKg: 75,
      timeframeWeeks: -3,
      tdeeKcal: 2500,
    });

    // Both are treated identically to a 1-week plan -- an extremely
    // aggressive implied deficit, so the 25% cap always engages.
    expect(zeroWeeks.adjusted).toBe(true);
    expect(zeroWeeks.reasonCodes).toContain("deficit_capped_25_percent");
    expect(negativeWeeks).toEqual(zeroWeeks);
  });

  it("test_AS_030_reason_codes_are_returned_as_a_stable_string_enum_not_free_text", () => {
    const result = planGoalAdjustment({
      sex: "male",
      currentWeightKg: 100,
      targetWeightKg: 90,
      timeframeWeeks: 8,
      tdeeKcal: 2600,
    });
    for (const code of result.reasonCodes) {
      expect(["deficit_capped_25_percent", "floor_kcal_applied"]).toContain(
        code
      );
    }
  });
});

describe("F014: purity / no side effects", () => {
  it("test_AS_021_bmr_is_pure_repeated_calls_with_identical_input_return_identical_output", () => {
    const a = bmr("male", 80, 180, 25);
    const b = bmr("male", 80, 180, 25);
    expect(a).toBe(b);
  });

  it("test_AS_025_macroTargets_does_not_mutate_its_inputs_or_leak_shared_state_between_calls", () => {
    const first = macroTargets(80, 2400);
    const second = macroTargets(60, 1500);
    // Mutating the first result must not affect a fresh call -- proves no
    // shared/module-level mutable state leaks between invocations.
    const mutated = { ...first, proteinG: -1 };
    expect(mutated.proteinG).toBe(-1);
    const third = macroTargets(80, 2400);
    expect(third).toEqual(first);
    expect(second).not.toEqual(first);
  });

  it("test_AS_030_planGoalAdjustment_does_not_mutate_the_input_object", () => {
    const input = {
      sex: "male" as const,
      currentWeightKg: 90,
      targetWeightKg: 85,
      timeframeWeeks: 10,
      tdeeKcal: 2500,
    };
    const snapshot = { ...input };
    planGoalAdjustment(input);
    expect(input).toEqual(snapshot);
  });
});

// Fixes from the clinical review (2026-07-19): the two spots where the engine
// could otherwise return a nonsensical plan for an edge-case user.
describe("F014: clinical-review fixes", () => {
  // #1 -- the sex-specific kcal floor must never lift a deficit target ABOVE
  // TDEE. A small/older/sedentary woman can have TDEE < the 1200 floor; the
  // old code handed her `floor` (a surplus while trying to lose).
  it("test_floor_never_exceeds_tdee_in_dailyTarget", () => {
    // TDEE 1100 < female floor 1200 -> target caps at TDEE (1100), not 1200.
    expect(dailyTarget(1100, "female", 0.2)).toBe(1100);
    expect(dailyTarget(1100, "female", 0.2)).toBeLessThanOrEqual(1100);
  });

  it("test_normal_deficit_is_unchanged_by_the_tdee_cap", () => {
    // Regression guard: a comfortable TDEE is unaffected by the new cap.
    expect(dailyTarget(2500, "male", 0.2)).toBe(2000);
  });

  it("test_floor_exceeds_tdee_flag_on_lose_goal", () => {
    const result = planGoalAdjustment({
      sex: "female",
      currentWeightKg: 60,
      targetWeightKg: 50,
      timeframeWeeks: 8,
      tdeeKcal: 1100,
    });
    expect(result.dailyKcal).toBe(1100); // capped at TDEE, not the 1200 floor
    expect(result.dailyKcal).toBeLessThanOrEqual(1100);
    expect(result.reasonCodes).toContain("floor_exceeds_tdee");
  });

  it("test_floor_exceeds_tdee_flag_on_tone_goal", () => {
    const result = planForGoal({
      goal: "tone",
      sex: "female",
      currentWeightKg: 50,
      targetWeightKg: null,
      timeframeWeeks: null,
      tdeeKcal: 1100,
    });
    expect(result.dailyKcal).toBe(1100); // never a surplus for a recomp goal
    expect(result.reasonCodes).toContain("floor_exceeds_tdee");
  });

  // #2 -- protein must give way (down to its 1.6 g/kg floor) once fat is
  // already at its floor, instead of pushing the split over budget / carbs
  // negative for a heavy user on a max deficit.
  it("test_protein_walks_down_to_its_floor_when_budget_is_extremely_tight", () => {
    const result = macroTargets(150, 1200);
    expect(result.clamped).toBe(true);
    expect(result.fatG).toBe(round1(150 * FAT_G_PER_KG_MIN)); // fat at its floor
    expect(result.proteinG).toBe(round1(150 * PROTEIN_G_PER_KG_MIN)); // protein at its floor
    expect(result.proteinG).toBeGreaterThanOrEqual(round1(150 * PROTEIN_G_PER_KG_MIN));
    expect(result.carbsG).toBe(0);
  });

  it("test_protein_stays_at_default_under_a_comfortable_budget", () => {
    // Regression guard: normal budgets keep protein at the 2.0 g/kg default.
    const result = macroTargets(80, 2400);
    expect(result.proteinG).toBe(round1(80 * PROTEIN_G_PER_KG));
    expect(result.clamped).toBe(false);
  });
});
