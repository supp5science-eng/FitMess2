import { describe, expect, it } from "vitest";

import {
  computeBudgetSummary,
  explainGoalAdjustment,
  isOnboardingDataComplete,
  parseOnboardingSearchParams,
} from "../summary";
import { EMPTY_ONBOARDING_DATA } from "../types";
import type { OnboardingData } from "../types";

// F016: unit coverage for the summary screen's pure helpers (AS-020,
// AS-030). AS-031 (onboarded_at + targets row persistence) is covered by
// persist.test.ts and the live integration test.

describe("parseOnboardingSearchParams: reads the F015 -> F016 hand-off query string", () => {
  it("test_AS_020_parses_all_seven_query_params_into_typed_fields", () => {
    const data = parseOnboardingSearchParams({
      pol: "female",
      godine: "29",
      visina: "168",
      tezina: "80",
      aktivnost: "moderate",
      ciljnaTezina: "74",
      nedelje: "12",
    });

    expect(data).toEqual({
      sex: "female",
      ageYears: 29,
      heightCm: 168,
      weightKg: 80,
      activityLevel: "moderate",
      targetWeightKg: 74,
      timeframeWeeks: 12,
    });
  });

  it("test_AS_020_a_missing_query_string_never_throws_and_yields_all_null_fields", () => {
    const data = parseOnboardingSearchParams({});
    expect(data).toEqual(EMPTY_ONBOARDING_DATA);
  });

  it("test_AS_020_malformed_values_degrade_to_null_rather_than_throwing", () => {
    const data = parseOnboardingSearchParams({
      pol: "invalid-value",
      godine: "not-a-number",
      aktivnost: "flying",
    });

    expect(data.sex).toBeNull();
    expect(data.ageYears).toBeNull();
    expect(data.activityLevel).toBeNull();
  });

  it("test_AS_020_an_array_query_value_takes_the_first_entry", () => {
    const data = parseOnboardingSearchParams({ pol: ["male", "female"] });
    expect(data.sex).toBe("male");
  });
});

describe("isOnboardingDataComplete: the empty-state gate", () => {
  it("test_AS_020_a_fully_populated_hand_off_is_complete", () => {
    const data: OnboardingData = {
      sex: "female",
      ageYears: 29,
      heightCm: 168,
      weightKg: 80,
      activityLevel: "moderate",
      targetWeightKg: 74,
      timeframeWeeks: 12,
    };
    expect(isOnboardingDataComplete(data)).toBe(true);
  });

  it("test_AS_020_a_single_missing_field_is_not_complete_renders_empty_state", () => {
    const data: OnboardingData = {
      sex: "female",
      ageYears: 29,
      heightCm: 168,
      weightKg: 80,
      activityLevel: "moderate",
      targetWeightKg: 74,
      timeframeWeeks: null,
    };
    expect(isOnboardingDataComplete(data)).toBe(false);
  });

  it("test_AS_020_no_data_at_all_is_not_complete", () => {
    expect(isOnboardingDataComplete(EMPTY_ONBOARDING_DATA)).toBe(false);
  });
});

describe("computeBudgetSummary: recompute-on-edit is a pure function of the current inputs (AS-020)", () => {
  const base = {
    sex: "female" as const,
    ageYears: 29,
    heightCm: 168,
    weightKg: 80,
    activityLevel: "moderate" as const,
    targetWeightKg: 74,
    timeframeWeeks: 12,
  };

  it("test_AS_020_computing_the_same_inputs_twice_yields_identical_output", () => {
    expect(computeBudgetSummary(base)).toEqual(computeBudgetSummary(base));
  });

  it("test_AS_020_editing_activity_level_changes_the_computed_daily_and_weekly_budget", () => {
    const sedentary = computeBudgetSummary({
      ...base,
      activityLevel: "sedentary",
    });
    const veryActive = computeBudgetSummary({
      ...base,
      activityLevel: "very_active",
    });

    expect(veryActive.tdeeKcal).toBeGreaterThan(sedentary.tdeeKcal);
    expect(veryActive.dailyKcal).not.toBe(sedentary.dailyKcal);
    expect(veryActive.weeklyKcal).toBe(veryActive.dailyKcal * 7);
  });

  it("test_AS_020_editing_weight_changes_the_computed_macros", () => {
    const lighter = computeBudgetSummary({ ...base, weightKg: 60 });
    const heavier = computeBudgetSummary({ ...base, weightKg: 100 });

    expect(heavier.macros.proteinG).toBeGreaterThan(lighter.macros.proteinG);
  });

  it("test_AS_020_editing_sex_changes_the_computed_bmr_and_daily_budget", () => {
    const female = computeBudgetSummary({ ...base, sex: "female" });
    const male = computeBudgetSummary({ ...base, sex: "male" });

    expect(male.bmrKcal).not.toBe(female.bmrKcal);
  });

  it("test_AS_020_editing_the_goal_changes_the_daily_budget_via_planGoalAdjustment", () => {
    const smallGoal = computeBudgetSummary({
      ...base,
      targetWeightKg: 78,
      timeframeWeeks: 26,
    });
    const aggressiveGoal = computeBudgetSummary({
      ...base,
      targetWeightKg: 60,
      timeframeWeeks: 8,
    });

    expect(aggressiveGoal.dailyKcal).toBeLessThanOrEqual(smallGoal.dailyKcal);
  });
});

describe("explainGoalAdjustment: AS-030 Serbian explanation copy", () => {
  it("test_AS_030_deficit_capped_reason_code_produces_a_serbian_sentence_mentioning_25_percent", () => {
    const messages = explainGoalAdjustment(
      ["deficit_capped_25_percent"],
      "female"
    );
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatch(/25%/);
    expect(messages[0]).toMatch(/deficit/i);
  });

  it("test_AS_030_floor_kcal_reason_code_mentions_the_sex_specific_floor_value", () => {
    const femaleMessages = explainGoalAdjustment(
      ["floor_kcal_applied"],
      "female"
    );
    const maleMessages = explainGoalAdjustment(["floor_kcal_applied"], "male");

    expect(femaleMessages[0]).toMatch(/1200/);
    expect(maleMessages[0]).toMatch(/1400/);
  });

  it("test_AS_030_no_reason_codes_produces_no_explanation_text", () => {
    expect(explainGoalAdjustment([], "female")).toEqual([]);
  });

  it("test_AS_030_a_goal_within_safe_bounds_never_triggers_an_adjustment_explanation_end_to_end", () => {
    const summary = computeBudgetSummary({
      sex: "female",
      ageYears: 29,
      heightCm: 168,
      weightKg: 80,
      activityLevel: "moderate",
      targetWeightKg: 78,
      timeframeWeeks: 26,
    });
    expect(summary.goal.adjusted).toBe(false);
    expect(explainGoalAdjustment(summary.goal.reasonCodes, "female")).toEqual(
      []
    );
  });

  it("test_AS_030_an_unsafe_goal_produces_both_a_true_adjusted_flag_and_matching_serbian_explanation_end_to_end", () => {
    // Aggressive: 30kg in 4 weeks for a smaller-bodied woman -- guaranteed
    // to blow through both the 25% deficit cap and the 1200 kcal floor.
    const summary = computeBudgetSummary({
      sex: "female",
      ageYears: 29,
      heightCm: 160,
      weightKg: 65,
      activityLevel: "sedentary",
      targetWeightKg: 35,
      timeframeWeeks: 4,
    });

    expect(summary.goal.adjusted).toBe(true);
    const messages = explainGoalAdjustment(
      summary.goal.reasonCodes,
      "female"
    );
    expect(messages.length).toBeGreaterThan(0);
  });
});
