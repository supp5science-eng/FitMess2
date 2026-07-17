import { describe, expect, it } from "vitest";

import {
  MAX_AGE_YEARS,
  MAX_HEIGHT_CM,
  MAX_TIMEFRAME_WEEKS,
  MAX_WEIGHT_KG,
  MIN_AGE_YEARS,
  MIN_HEIGHT_CM,
  MIN_TIMEFRAME_WEEKS,
  MIN_WEIGHT_KG,
  validateActivityLevel,
  validateAge,
  validateGoal,
  validateHeight,
  validateSex,
  validateWeight,
} from "../validation";

// F015: pure unit coverage for every per-step validation rule the wizard UI
// relies on (AS-019 -- "onboarding collects sex, age, height, weight,
// activity level (5 tiers), target weight, and timeframe", each with
// "sensible ranges" and "Serbian inline validation messages" per the
// clarified spec).

describe("AS-019: validateSex (pol step)", () => {
  it("test_AS_019_validateSex_accepts_male", () => {
    expect(validateSex("male")).toEqual({ valid: true });
  });

  it("test_AS_019_validateSex_accepts_female", () => {
    expect(validateSex("female")).toEqual({ valid: true });
  });

  it("test_AS_019_validateSex_rejects_null_with_a_serbian_message", () => {
    const result = validateSex(null);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toMatch(/pol/i);
    }
  });
});

describe("AS-019: validateAge (godine step)", () => {
  it("test_AS_019_validateAge_accepts_a_value_inside_the_sane_range", () => {
    expect(validateAge(30)).toEqual({ valid: true });
  });

  it("test_AS_019_validateAge_accepts_the_exact_lower_boundary", () => {
    expect(validateAge(MIN_AGE_YEARS)).toEqual({ valid: true });
  });

  it("test_AS_019_validateAge_accepts_the_exact_upper_boundary", () => {
    expect(validateAge(MAX_AGE_YEARS)).toEqual({ valid: true });
  });

  it("test_AS_019_validateAge_rejects_below_the_lower_boundary", () => {
    const result = validateAge(MIN_AGE_YEARS - 1);
    expect(result.valid).toBe(false);
  });

  it("test_AS_019_validateAge_rejects_above_the_upper_boundary", () => {
    const result = validateAge(MAX_AGE_YEARS + 1);
    expect(result.valid).toBe(false);
  });

  it("test_AS_019_validateAge_rejects_null_with_a_serbian_message", () => {
    const result = validateAge(null);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/godine/i);
  });

  it("test_AS_019_validateAge_rejects_a_non_integer", () => {
    const result = validateAge(30.5);
    expect(result.valid).toBe(false);
  });

  it("test_AS_019_validateAge_rejects_NaN", () => {
    const result = validateAge(NaN);
    expect(result.valid).toBe(false);
  });
});

describe("AS-019: validateHeight (visina step)", () => {
  it("test_AS_019_validateHeight_accepts_a_typical_value", () => {
    expect(validateHeight(175)).toEqual({ valid: true });
  });

  it("test_AS_019_validateHeight_accepts_the_exact_boundaries", () => {
    expect(validateHeight(MIN_HEIGHT_CM)).toEqual({ valid: true });
    expect(validateHeight(MAX_HEIGHT_CM)).toEqual({ valid: true });
  });

  it("test_AS_019_validateHeight_rejects_below_the_lower_boundary", () => {
    expect(validateHeight(MIN_HEIGHT_CM - 1).valid).toBe(false);
  });

  it("test_AS_019_validateHeight_rejects_above_the_upper_boundary", () => {
    expect(validateHeight(MAX_HEIGHT_CM + 1).valid).toBe(false);
  });

  it("test_AS_019_validateHeight_rejects_null_with_a_serbian_message", () => {
    const result = validateHeight(null);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/visin/i);
  });
});

describe("AS-019: validateWeight (težina step)", () => {
  it("test_AS_019_validateWeight_accepts_a_typical_value", () => {
    expect(validateWeight(80)).toEqual({ valid: true });
  });

  it("test_AS_019_validateWeight_accepts_the_exact_boundaries", () => {
    expect(validateWeight(MIN_WEIGHT_KG)).toEqual({ valid: true });
    expect(validateWeight(MAX_WEIGHT_KG)).toEqual({ valid: true });
  });

  it("test_AS_019_validateWeight_rejects_below_the_lower_boundary", () => {
    expect(validateWeight(MIN_WEIGHT_KG - 1).valid).toBe(false);
  });

  it("test_AS_019_validateWeight_rejects_above_the_upper_boundary", () => {
    expect(validateWeight(MAX_WEIGHT_KG + 1).valid).toBe(false);
  });

  it("test_AS_019_validateWeight_rejects_null_with_a_serbian_message", () => {
    const result = validateWeight(null);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/težin/i);
  });
});

describe("AS-019: validateActivityLevel (5 tiers)", () => {
  it.each([
    "sedentary",
    "light",
    "moderate",
    "active",
    "very_active",
  ] as const)("test_AS_019_validateActivityLevel_accepts_tier_%s", (tier) => {
    expect(validateActivityLevel(tier)).toEqual({ valid: true });
  });

  it("test_AS_019_validateActivityLevel_rejects_null_with_a_serbian_message", () => {
    const result = validateActivityLevel(null);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/aktivnost/i);
  });
});

describe("AS-019: validateGoal (cilj step -- target weight + timeframe)", () => {
  it("test_AS_019_validateGoal_accepts_a_sane_loss_goal", () => {
    expect(validateGoal(74, 12, 80)).toEqual({ valid: true });
  });

  it("test_AS_019_validateGoal_accepts_the_exact_timeframe_lower_boundary", () => {
    expect(validateGoal(74, MIN_TIMEFRAME_WEEKS, 80)).toEqual({ valid: true });
  });

  it("test_AS_019_validateGoal_accepts_the_exact_timeframe_upper_boundary", () => {
    expect(validateGoal(74, MAX_TIMEFRAME_WEEKS, 80)).toEqual({ valid: true });
  });

  it("test_AS_019_validateGoal_rejects_target_weight_equal_to_current_weight", () => {
    const result = validateGoal(80, 12, 80);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/manja od trenutne/i);
  });

  it("test_AS_019_validateGoal_rejects_target_weight_above_current_weight", () => {
    const result = validateGoal(85, 12, 80);
    expect(result.valid).toBe(false);
  });

  it("test_AS_019_validateGoal_rejects_a_timeframe_below_one_week", () => {
    const result = validateGoal(74, 0, 80);
    expect(result.valid).toBe(false);
  });

  it("test_AS_019_validateGoal_rejects_a_timeframe_above_the_upper_boundary", () => {
    const result = validateGoal(74, MAX_TIMEFRAME_WEEKS + 1, 80);
    expect(result.valid).toBe(false);
  });

  it("test_AS_019_validateGoal_rejects_a_non_integer_timeframe", () => {
    const result = validateGoal(74, 12.5, 80);
    expect(result.valid).toBe(false);
  });

  it("test_AS_019_validateGoal_rejects_null_target_weight_with_a_serbian_message", () => {
    const result = validateGoal(null, 12, 80);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/ciljnu težinu/i);
  });

  it("test_AS_019_validateGoal_rejects_null_timeframe_with_a_serbian_message", () => {
    const result = validateGoal(74, null, 80);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/rok/i);
  });

  it("test_AS_019_validateGoal_rejects_target_weight_outside_the_weight_bounds", () => {
    expect(validateGoal(MIN_WEIGHT_KG - 1, 12, 80).valid).toBe(false);
    expect(validateGoal(MAX_WEIGHT_KG + 1, 12, 80).valid).toBe(false);
  });
});
