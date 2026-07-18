import { describe, expect, it } from "vitest";
import {
  filterAndMapOffHits,
  hasCompleteMacros,
  mapOffHitToFoodInsert,
  type OffHit,
} from "../off";

// F022: dataset-level (network-free) proof of the AS-035 quality filter --
// "the OFF import stores only entries with complete macro data and marks
// their source as OFF". These tests derive directly from the assertion
// text (complete macros + name required; source='off', verified=false),
// not from scripts/import-off.ts's implementation.

function completeHit(overrides: Partial<OffHit> = {}): OffHit {
  return {
    code: "8600043025873",
    product_name: "Plazma slana",
    brands: ["Bambi"],
    nutriments: {
      "energy-kcal_100g": 451,
      proteins_100g: 11,
      carbohydrates_100g: 62,
      fat_100g: 17,
    },
    ...overrides,
  };
}

describe("F022 off.ts: hasCompleteMacros (AS-035 quality filter)", () => {
  it("test_AS_035_accepts_a_hit_with_name_and_all_four_macros", () => {
    expect(hasCompleteMacros(completeHit())).toBe(true);
  });

  it("test_AS_035_rejects_synthetic_incomplete_macro_record_missing_kcal", () => {
    const hit = completeHit({
      nutriments: {
        proteins_100g: 11,
        carbohydrates_100g: 62,
        fat_100g: 17,
        // energy-kcal_100g deliberately absent
      },
    });
    expect(hasCompleteMacros(hit)).toBe(false);
  });

  it("test_AS_035_rejects_incomplete_macro_record_missing_protein", () => {
    const hit = completeHit({
      nutriments: {
        "energy-kcal_100g": 451,
        carbohydrates_100g: 62,
        fat_100g: 17,
      },
    });
    expect(hasCompleteMacros(hit)).toBe(false);
  });

  it("test_AS_035_rejects_incomplete_macro_record_missing_carbs", () => {
    const hit = completeHit({
      nutriments: {
        "energy-kcal_100g": 451,
        proteins_100g: 11,
        fat_100g: 17,
      },
    });
    expect(hasCompleteMacros(hit)).toBe(false);
  });

  it("test_AS_035_rejects_incomplete_macro_record_missing_fat", () => {
    const hit = completeHit({
      nutriments: {
        "energy-kcal_100g": 451,
        proteins_100g: 11,
        carbohydrates_100g: 62,
      },
    });
    expect(hasCompleteMacros(hit)).toBe(false);
  });

  it("test_AS_035_rejects_a_hit_with_macros_but_no_product_name", () => {
    const hit = completeHit({ product_name: "", product_name_sr: undefined });
    expect(hasCompleteMacros(hit)).toBe(false);
  });

  it("test_AS_035_rejects_non_numeric_macro_values", () => {
    const hit = completeHit({
      nutriments: {
        "energy-kcal_100g": "n/a" as unknown as number,
        proteins_100g: 11,
        carbohydrates_100g: 62,
        fat_100g: 17,
      },
    });
    expect(hasCompleteMacros(hit)).toBe(false);
  });

  it("test_AS_035_rejects_negative_macro_values", () => {
    const hit = completeHit({
      nutriments: {
        "energy-kcal_100g": 451,
        proteins_100g: -5,
        carbohydrates_100g: 62,
        fat_100g: 17,
      },
    });
    expect(hasCompleteMacros(hit)).toBe(false);
  });

  it("test_AS_035_accepts_zero_as_a_valid_macro_value", () => {
    const hit = completeHit({
      nutriments: {
        "energy-kcal_100g": 0,
        proteins_100g: 0,
        carbohydrates_100g: 0,
        fat_100g: 0,
      },
    });
    expect(hasCompleteMacros(hit)).toBe(true);
  });

  it("test_AS_035_prefers_serbian_localized_name_when_present", () => {
    const hit = completeHit({
      product_name: "Salty Plazma",
      product_name_sr: "Plazma slana",
    });
    const insert = mapOffHitToFoodInsert(hit);
    expect(insert?.name_sr).toBe("Plazma slana");
  });
});

describe("F022 off.ts: mapOffHitToFoodInsert (source/verified stamp)", () => {
  it("test_AS_035_mapped_row_has_source_off_and_verified_false", () => {
    const insert = mapOffHitToFoodInsert(completeHit());
    expect(insert).not.toBeNull();
    expect(insert?.source).toBe("off");
    expect(insert?.verified).toBe(false);
  });

  it("test_AS_035_mapped_row_carries_barcode_from_code_field", () => {
    const insert = mapOffHitToFoodInsert(completeHit({ code: "1234567890123" }));
    expect(insert?.barcode).toBe("1234567890123");
  });

  it("test_AS_035_mapped_row_carries_all_four_macros_numerically", () => {
    const insert = mapOffHitToFoodInsert(completeHit());
    expect(insert).toEqual(
      expect.objectContaining({
        kcal_100g: 451,
        protein_100g: 11,
        carbs_100g: 62,
        fat_100g: 17,
      })
    );
  });

  it("test_AS_035_joins_multiple_brands_into_one_string", () => {
    const insert = mapOffHitToFoodInsert(
      completeHit({ brands: ["McDonald's", "Develey"] })
    );
    expect(insert?.brand).toBe("McDonald's, Develey");
  });

  it("test_AS_035_handles_comma_separated_string_brands_shape", () => {
    const insert = mapOffHitToFoodInsert(
      completeHit({ brands: "Imlek, Mlekara" as unknown })
    );
    expect(insert?.brand).toBe("Imlek, Mlekara");
  });

  it("test_mapOffHitToFoodInsert_returns_null_for_incomplete_macro_hit", () => {
    const hit = completeHit({
      nutriments: { proteins_100g: 11 },
    });
    expect(mapOffHitToFoodInsert(hit)).toBeNull();
  });

  it("test_mapOffHitToFoodInsert_returns_null_when_barcode_missing", () => {
    const hit = completeHit({ code: undefined });
    expect(mapOffHitToFoodInsert(hit)).toBeNull();
  });
});

describe("F022 off.ts: filterAndMapOffHits (quality filter + dedup pipeline)", () => {
  it("test_AS_035_filter_rejects_a_synthetic_incomplete_macro_record_end_to_end", () => {
    const hits: unknown[] = [
      completeHit(),
      completeHit({
        code: "0000000000001",
        product_name: "Sumnjivi proizvod",
        nutriments: { proteins_100g: 3 }, // missing kcal/carbs/fat
      }),
    ];

    const result = filterAndMapOffHits(hits, new Set());

    expect(result.toInsert).toHaveLength(1);
    expect(result.toInsert[0].barcode).toBe("8600043025873");
    expect(result.skippedMissingMacros).toHaveLength(1);
    expect(result.skippedMissingMacros[0].reason).toBe("missing-macros");
  });

  it("test_filterAndMapOffHits_skips_duplicate_against_existing_db_barcodes", () => {
    const hits: unknown[] = [completeHit({ code: "8600043025873" })];
    const result = filterAndMapOffHits(
      hits,
      new Set(["8600043025873"])
    );

    expect(result.toInsert).toHaveLength(0);
    expect(result.skippedDuplicate).toEqual([{ barcode: "8600043025873" }]);
  });

  it("test_filterAndMapOffHits_dedupes_repeats_within_the_same_batch", () => {
    const hits: unknown[] = [
      completeHit({ code: "8600043025873" }),
      completeHit({ code: "8600043025873" }),
    ];
    const result = filterAndMapOffHits(hits, new Set());

    expect(result.toInsert).toHaveLength(1);
    expect(result.skippedDuplicate).toEqual([{ barcode: "8600043025873" }]);
  });

  it("test_filterAndMapOffHits_skips_hit_with_no_barcode", () => {
    const hits: unknown[] = [completeHit({ code: undefined })];
    const result = filterAndMapOffHits(hits, new Set());

    expect(result.toInsert).toHaveLength(0);
    expect(result.skippedMissingMacros[0].reason).toBe("missing-barcode");
  });

  it("test_filterAndMapOffHits_returns_three_disjoint_buckets_summing_to_input_length", () => {
    const hits: unknown[] = [
      completeHit({ code: "1111111111111" }),
      completeHit({ code: "1111111111111" }), // duplicate within batch
      completeHit({ code: "2222222222222", nutriments: {} }), // missing macros
      completeHit({ code: "3333333333333" }),
    ];
    const result = filterAndMapOffHits(
      hits,
      new Set(["3333333333333"]) // pre-existing duplicate
    );

    const total =
      result.toInsert.length +
      result.skippedMissingMacros.length +
      result.skippedDuplicate.length;
    expect(total).toBe(hits.length);
    expect(result.toInsert).toHaveLength(1);
    expect(result.skippedMissingMacros).toHaveLength(1);
    expect(result.skippedDuplicate).toHaveLength(2);
  });
});
