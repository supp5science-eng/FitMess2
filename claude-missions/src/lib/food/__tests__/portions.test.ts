import { describe, expect, it } from "vitest";

import {
  computeMacrosForGrams,
  findMatchingCommonUnit,
  gramsSchema,
  MAX_PORTION_GRAMS,
  MIN_PORTION_GRAMS,
  resolveUnitGrams,
  roundToOneDecimal,
  type PortionFoodInput,
} from "@/lib/food/portions";
import type { FoodCommonUnit } from "@/lib/types/db";

// F025 / AS-041 (log by grams computes kcal + macros from per-100g values),
// AS-042 (log by a common unit uses the unit's gram weight x quantity) --
// pure, DB-free coverage of `src/lib/food/portions.ts`'s core math, per the
// clarified "unit-test the pure gram math" definition-of-done answer.

const APPLE: PortionFoodInput = {
  id: "food-apple",
  name_sr: "Jabuka",
  kcal_100g: 52,
  protein_100g: 0.3,
  carbs_100g: 14,
  fat_100g: 0.2,
};

describe("F025 / AS-041: computeMacrosForGrams -- grams -> kcal + macros from per-100g values", () => {
  it("test_AS_041_100_grams_returns_exactly_the_per_100g_values", () => {
    const result = computeMacrosForGrams(APPLE, 100);
    expect(result).toEqual({ kcal: 52, protein: 0.3, carbs: 14, fat: 0.2 });
  });

  it("test_AS_041_50_grams_returns_half_of_the_per_100g_values", () => {
    const result = computeMacrosForGrams(APPLE, 50);
    expect(result).toEqual({ kcal: 26, protein: 0.2, carbs: 7, fat: 0.1 });
  });

  it("test_AS_041_a_non_round_gram_amount_scales_proportionally_and_rounds_to_one_decimal", () => {
    const food: PortionFoodInput = {
      id: "food-x",
      name_sr: "Test namirnica",
      kcal_100g: 137,
      protein_100g: 8.4,
      carbs_100g: 21.7,
      fat_100g: 3.9,
    };
    const result = computeMacrosForGrams(food, 63);

    // 137 * 0.63 = 86.31 -> 86.3; 8.4*0.63=5.292 -> 5.3; 21.7*0.63=13.671 -> 13.7; 3.9*0.63=2.457 -> 2.5
    expect(result).toEqual({ kcal: 86.3, protein: 5.3, carbs: 13.7, fat: 2.5 });
  });

  it("test_AS_041_zero_grams_returns_all_zero_macros", () => {
    const result = computeMacrosForGrams(APPLE, 0);
    expect(result).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  });

  it("test_AS_041_a_food_with_zero_per_100g_values_always_computes_zero_regardless_of_grams", () => {
    const zeroFood: PortionFoodInput = {
      id: "food-zero",
      name_sr: "Voda",
      kcal_100g: 0,
      protein_100g: 0,
      carbs_100g: 0,
      fat_100g: 0,
    };
    expect(computeMacrosForGrams(zeroFood, 250)).toEqual({
      kcal: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    });
  });
});

describe("F025 / AS-042: resolveUnitGrams -- a common unit resolves to its gram weight x quantity", () => {
  const parce: FoodCommonUnit = { label: "parče", grams: 50 };

  it("test_AS_042_a_single_unit_resolves_to_exactly_its_gram_weight", () => {
    expect(resolveUnitGrams(parce, 1)).toBe(50);
  });

  it("test_AS_042_two_of_a_unit_resolves_to_double_the_gram_weight", () => {
    expect(resolveUnitGrams(parce, 2)).toBe(100);
  });

  it("test_AS_042_a_fractional_quantity_scales_the_gram_weight_proportionally", () => {
    expect(resolveUnitGrams(parce, 1.5)).toBe(75);
  });

  it("test_AS_042_resolved_unit_grams_feed_directly_into_computeMacrosForGrams_for_the_matching_macros", () => {
    const food: PortionFoodInput = {
      id: "food-slice",
      name_sr: "Hleb",
      kcal_100g: 265,
      protein_100g: 9,
      carbs_100g: 49,
      fat_100g: 3.2,
    };
    const slice: FoodCommonUnit = { label: "parče", grams: 30 };

    // "2 parčeta" -- AS-042's own example quantity.
    const grams = resolveUnitGrams(slice, 2);
    expect(grams).toBe(60);

    const macros = computeMacrosForGrams(food, grams);
    // 265 * 0.6 = 159; 9*0.6=5.4; 49*0.6=29.4; 3.2*0.6=1.92 -> 1.9
    expect(macros).toEqual({ kcal: 159, protein: 5.4, carbs: 29.4, fat: 1.9 });
  });
});

describe("F025: roundToOneDecimal", () => {
  it("test_rounds_to_one_decimal_place", () => {
    expect(roundToOneDecimal(1.23)).toBe(1.2);
    expect(roundToOneDecimal(1.25)).toBe(1.3);
    expect(roundToOneDecimal(100)).toBe(100);
  });
});

describe("F026 / AS-044: findMatchingCommonUnit -- pre-loading an edit sheet's unit/quantity from a saved grams amount", () => {
  const units: FoodCommonUnit[] = [
    { label: "parče", grams: 50 },
    { label: "komad", grams: 120 },
  ];

  it("test_AS_044_a_grams_amount_matching_a_single_unit_returns_quantity_1", () => {
    expect(findMatchingCommonUnit(units, 50)).toEqual({
      unitIndex: 0,
      quantity: 1,
    });
  });

  it("test_AS_044_a_grams_amount_matching_two_of_a_unit_returns_quantity_2", () => {
    expect(findMatchingCommonUnit(units, 100)).toEqual({
      unitIndex: 0,
      quantity: 2,
    });
  });

  it("test_AS_044_a_grams_amount_matching_a_fractional_quantity_of_a_later_unit_is_found", () => {
    // 120 * 1.5 = 180
    expect(findMatchingCommonUnit(units, 180)).toEqual({
      unitIndex: 1,
      quantity: 1.5,
    });
  });

  it("test_AS_044_a_grams_amount_matching_no_unit_returns_null", () => {
    expect(findMatchingCommonUnit(units, 137)).toBeNull();
  });

  it("test_AS_044_an_empty_units_list_always_returns_null", () => {
    expect(findMatchingCommonUnit([], 50)).toBeNull();
  });
});

describe("F025: gramsSchema -- portion bounds validation", () => {
  it("test_a_positive_grams_amount_within_bounds_is_valid", () => {
    expect(gramsSchema.safeParse(150).success).toBe(true);
    expect(gramsSchema.safeParse(MIN_PORTION_GRAMS).success).toBe(true);
    expect(gramsSchema.safeParse(MAX_PORTION_GRAMS).success).toBe(true);
  });

  it("test_zero_or_negative_grams_is_rejected", () => {
    expect(gramsSchema.safeParse(0).success).toBe(false);
    expect(gramsSchema.safeParse(-10).success).toBe(false);
  });

  it("test_an_amount_above_the_max_bound_is_rejected", () => {
    expect(gramsSchema.safeParse(MAX_PORTION_GRAMS + 0.1).success).toBe(false);
  });
});
