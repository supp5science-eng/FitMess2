import { describe, expect, it } from "vitest";

import {
  automaticStepGoal,
  clampStepGoal,
  FALLBACK_STEP_GOAL,
  MAX_STEP_GOAL,
  MIN_STEP_GOAL,
  MIN_DAYS_FOR_SUGGESTION,
  resolveStepGoal,
  STEP_GOAL_BY_ACTIVITY,
  stepGoalOptions,
  suggestStepGoalFromHistory,
} from "../step-goal";

// Cilj koraka: the app used to measure everybody against 10.000 steps -- a
// figure from a 1965 pedometer advert, not from medicine, and one a sedentary
// user fails every single day.

describe("automatic goal", () => {
  it("test_nobody_is_measured_against_a_flat_10000_any_more", () => {
    const goals = Object.values(STEP_GOAL_BY_ACTIVITY);
    // The only level that may legitimately land near 10k is the top one.
    expect(STEP_GOAL_BY_ACTIVITY.sedentary).toBeLessThan(7000);
    expect(goals.filter((goal) => goal === 10000)).toHaveLength(0);
  });

  it("test_the_goal_rises_with_the_activity_level", () => {
    expect(STEP_GOAL_BY_ACTIVITY.sedentary).toBeLessThan(
      STEP_GOAL_BY_ACTIVITY.light
    );
    expect(STEP_GOAL_BY_ACTIVITY.light).toBeLessThan(
      STEP_GOAL_BY_ACTIVITY.moderate
    );
    expect(STEP_GOAL_BY_ACTIVITY.moderate).toBeLessThan(
      STEP_GOAL_BY_ACTIVITY.active
    );
    expect(STEP_GOAL_BY_ACTIVITY.active).toBeLessThan(
      STEP_GOAL_BY_ACTIVITY.very_active
    );
  });

  it("test_a_profile_without_an_activity_level_falls_back_to_the_middle", () => {
    expect(automaticStepGoal(null)).toBe(FALLBACK_STEP_GOAL);
    expect(automaticStepGoal(undefined)).toBe(FALLBACK_STEP_GOAL);
  });
});

describe("resolveStepGoal", () => {
  it("test_the_users_own_goal_wins_over_the_automatic_one", () => {
    const resolved = resolveStepGoal("very_active", 4000);

    expect(resolved.goal).toBe(4000);
    expect(resolved.source).toBe("custom");
    // Still reports what automatic WOULD be, so settings can offer to go back.
    expect(resolved.automaticGoal).toBe(STEP_GOAL_BY_ACTIVITY.very_active);
  });

  it("test_no_custom_goal_means_the_activity_derived_one", () => {
    const resolved = resolveStepGoal("sedentary", null);

    expect(resolved.goal).toBe(STEP_GOAL_BY_ACTIVITY.sedentary);
    expect(resolved.source).toBe("activity");
  });

  it("test_a_stored_goal_out_of_bounds_is_clamped_not_trusted", () => {
    expect(resolveStepGoal("light", 500).goal).toBe(MIN_STEP_GOAL);
    expect(resolveStepGoal("light", 999999).goal).toBe(MAX_STEP_GOAL);
  });

  it("test_a_missing_activity_level_is_reported_as_a_fallback_not_a_choice", () => {
    expect(resolveStepGoal(null, null)).toEqual({
      goal: FALLBACK_STEP_GOAL,
      source: "fallback",
      automaticGoal: FALLBACK_STEP_GOAL,
    });
  });
});

describe("clampStepGoal + options", () => {
  it("test_values_land_on_the_500_grid", () => {
    expect(clampStepGoal(7240)).toBe(7000);
    expect(clampStepGoal(7260)).toBe(7500);
  });

  it("test_every_offered_option_survives_a_round_trip", () => {
    const options = stepGoalOptions();

    expect(options[0]).toBe(MIN_STEP_GOAL);
    expect(options.at(-1)).toBe(MAX_STEP_GOAL);
    for (const option of options) {
      expect(clampStepGoal(option)).toBe(option);
    }
  });
});

describe("suggestion from the user's own history", () => {
  it("test_suggests_a_goal_just_above_the_users_average", () => {
    const suggestion = suggestStepGoalFromHistory([
      6000, 6500, 5500, 6200, 6300,
    ]);

    expect(suggestion).not.toBeNull();
    expect(suggestion!.averageSteps).toBe(6100);
    expect(suggestion!.basedOnDays).toBe(5);
    expect(suggestion!.suggestedGoal).toBe(6500);
  });

  it("test_days_without_an_entry_are_not_counted_as_zero_step_days", () => {
    // A day nobody logged is missing data, not a day spent in bed -- averaging
    // it in as 0 would drag the suggestion down for no reason.
    const withZeros = suggestStepGoalFromHistory([6000, 0, 6500, 0, 6100, 6200]);
    const withoutZeros = suggestStepGoalFromHistory([6000, 6500, 6100, 6200]);

    expect(withZeros).toEqual(withoutZeros);
  });

  it("test_too_few_days_means_no_suggestion_rather_than_a_made_up_one", () => {
    const days = Array.from({ length: MIN_DAYS_FOR_SUGGESTION - 1 }, () => 7000);

    expect(suggestStepGoalFromHistory(days)).toBeNull();
    expect(suggestStepGoalFromHistory([])).toBeNull();
  });

  it("test_the_suggestion_stays_inside_the_allowed_bounds", () => {
    const tiny = suggestStepGoalFromHistory([200, 300, 250, 400]);
    const huge = suggestStepGoalFromHistory([90000, 88000, 91000, 95000]);

    expect(tiny!.suggestedGoal).toBe(MIN_STEP_GOAL);
    expect(huge!.suggestedGoal).toBe(MAX_STEP_GOAL);
  });
});
