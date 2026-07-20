import { describe, expect, it } from "vitest";

import {
  FOOD_BRAND_TOO_LONG_ERROR_SR,
  FOOD_CARBS_INVALID_ERROR_SR,
  FOOD_FAT_INVALID_ERROR_SR,
  FOOD_KCAL_INVALID_ERROR_SR,
  FOOD_NAME_REQUIRED_ERROR_SR,
  FOOD_NAME_TOO_LONG_ERROR_SR,
  FOOD_PRICE_INVALID_ERROR_SR,
  FOOD_PROTEIN_INVALID_ERROR_SR,
  isUniqueBarcodeViolation,
  MAX_PRICE_RSD,
  newFoodEntrySchema,
} from "@/lib/food/create";

// F032: pure validation coverage for `newFoodEntrySchema` (the schema
// shared by `NewProductForm`'s client-side validation and `POST
// /api/foods`'s server-side validation, so both sides agree exactly on
// "numeric/sane" per the clarified validation answer) and
// `isUniqueBarcodeViolation` (AS-057's Postgres-error classifier). The
// live-DB insert/RLS/unique-constraint behaviour itself is covered by
// `src/app/api/foods/__tests__/route.integration.test.ts`.

function validEntry(overrides: Record<string, unknown> = {}) {
  return {
    name_sr: "Domaći ajvar",
    brand: "",
    barcode: "",
    kcal_100g: 250,
    protein_100g: 2,
    carbs_100g: 10,
    fat_100g: 20,
    ...overrides,
  };
}

describe("F032: newFoodEntrySchema", () => {
  it("test_a_fully_valid_entry_parses_successfully", () => {
    const result = newFoodEntrySchema.safeParse(validEntry());
    expect(result.success).toBe(true);
  });

  it("test_AS_055_a_valid_entry_with_a_prefilled_gtin_barcode_parses_successfully", () => {
    const result = newFoodEntrySchema.safeParse(
      validEntry({ barcode: "5901234123457" })
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.barcode).toBe("5901234123457");
    }
  });

  it("test_an_empty_name_is_rejected_with_a_serbian_error", () => {
    const result = newFoodEntrySchema.safeParse(validEntry({ name_sr: "" }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(FOOD_NAME_REQUIRED_ERROR_SR);
    }
  });

  it("test_a_whitespace_only_name_is_rejected", () => {
    const result = newFoodEntrySchema.safeParse(validEntry({ name_sr: "   " }));
    expect(result.success).toBe(false);
  });

  it("test_a_name_over_200_characters_is_rejected_with_a_serbian_error", () => {
    const result = newFoodEntrySchema.safeParse(
      validEntry({ name_sr: "a".repeat(201) })
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(FOOD_NAME_TOO_LONG_ERROR_SR);
    }
  });

  it("test_a_brand_over_200_characters_is_rejected_with_a_serbian_error", () => {
    const result = newFoodEntrySchema.safeParse(
      validEntry({ brand: "b".repeat(201) })
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(FOOD_BRAND_TOO_LONG_ERROR_SR);
    }
  });

  it("test_an_empty_brand_is_treated_as_not_provided", () => {
    const result = newFoodEntrySchema.safeParse(validEntry({ brand: "" }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.brand).toBeUndefined();
    }
  });

  it("test_an_empty_barcode_is_treated_as_not_provided_barcode_is_optional", () => {
    const result = newFoodEntrySchema.safeParse(validEntry({ barcode: "" }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.barcode).toBeUndefined();
    }
  });

  it("test_a_malformed_barcode_is_rejected", () => {
    const result = newFoodEntrySchema.safeParse(
      validEntry({ barcode: "not-a-barcode" })
    );
    expect(result.success).toBe(false);
  });

  it("test_a_negative_kcal_is_rejected_with_a_serbian_error", () => {
    const result = newFoodEntrySchema.safeParse(validEntry({ kcal_100g: -1 }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(FOOD_KCAL_INVALID_ERROR_SR);
    }
  });

  it("test_a_kcal_value_over_900_per_100g_is_rejected_as_insane", () => {
    const result = newFoodEntrySchema.safeParse(validEntry({ kcal_100g: 901 }));
    expect(result.success).toBe(false);
  });

  it("test_a_kcal_value_of_exactly_900_is_accepted_boundary", () => {
    const result = newFoodEntrySchema.safeParse(validEntry({ kcal_100g: 900 }));
    expect(result.success).toBe(true);
  });

  it("test_a_non_numeric_kcal_is_rejected", () => {
    const result = newFoodEntrySchema.safeParse(
      validEntry({ kcal_100g: Number.NaN })
    );
    expect(result.success).toBe(false);
  });

  it("test_protein_over_100g_per_100g_is_rejected_as_insane", () => {
    const result = newFoodEntrySchema.safeParse(
      validEntry({ protein_100g: 150 })
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        FOOD_PROTEIN_INVALID_ERROR_SR
      );
    }
  });

  it("test_carbs_over_100g_per_100g_is_rejected_as_insane", () => {
    const result = newFoodEntrySchema.safeParse(validEntry({ carbs_100g: 101 }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(FOOD_CARBS_INVALID_ERROR_SR);
    }
  });

  it("test_fat_over_100g_per_100g_is_rejected_as_insane", () => {
    const result = newFoodEntrySchema.safeParse(validEntry({ fat_100g: 100.5 }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(FOOD_FAT_INVALID_ERROR_SR);
    }
  });

  it("test_kcal_consistency_with_macros_is_not_enforced_user_entries_may_be_imperfect", () => {
    // 100g protein (400 kcal) + 100g carbs (400 kcal) + 100g fat (900 kcal)
    // would "really" be ~1700 kcal, but 250 kcal is entered -- per the
    // clarified spec this is "nice but not mandatory," an admin verifies
    // later (source='user', verified=false).
    const result = newFoodEntrySchema.safeParse(
      validEntry({
        kcal_100g: 250,
        protein_100g: 90,
        carbs_100g: 90,
        fat_100g: 90,
      })
    );
    expect(result.success).toBe(true);
  });
});

describe("Dodaj proizvod: optional price (RSD) on newFoodEntrySchema", () => {
  it("test_an_omitted_price_is_valid_price_is_optional", () => {
    const result = newFoodEntrySchema.safeParse(validEntry());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.price).toBeUndefined();
    }
  });

  it("test_a_valid_price_parses_and_is_kept", () => {
    const result = newFoodEntrySchema.safeParse(validEntry({ price: 149.99 }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.price).toBe(149.99);
    }
  });

  it("test_a_price_of_zero_is_accepted_boundary", () => {
    const result = newFoodEntrySchema.safeParse(validEntry({ price: 0 }));
    expect(result.success).toBe(true);
  });

  it("test_a_negative_price_is_rejected_with_a_serbian_error", () => {
    const result = newFoodEntrySchema.safeParse(validEntry({ price: -1 }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(FOOD_PRICE_INVALID_ERROR_SR);
    }
  });

  it("test_an_insane_price_over_the_ceiling_is_rejected", () => {
    const result = newFoodEntrySchema.safeParse(
      validEntry({ price: MAX_PRICE_RSD + 1 })
    );
    expect(result.success).toBe(false);
  });

  it("test_a_non_numeric_price_is_rejected", () => {
    const result = newFoodEntrySchema.safeParse(
      validEntry({ price: Number.NaN })
    );
    expect(result.success).toBe(false);
  });
});

describe("F032 / AS-057: isUniqueBarcodeViolation", () => {
  it("test_a_postgres_23505_error_is_classified_as_a_unique_barcode_violation", () => {
    expect(isUniqueBarcodeViolation({ code: "23505" })).toBe(true);
  });

  it("test_any_other_error_code_is_not_classified_as_a_unique_violation", () => {
    expect(isUniqueBarcodeViolation({ code: "23502" })).toBe(false);
    expect(isUniqueBarcodeViolation({ code: undefined })).toBe(false);
    expect(isUniqueBarcodeViolation({})).toBe(false);
  });
});
