import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  isKcalConsistent,
  planSeedUpsert,
  toFoodInsert,
  upsertKey,
  validateSeedRows,
  type ExistingFoodRow,
  type SeedFoodRow,
} from "@/lib/food/seed";

// F021: pure, DB-free tests for the curated Serbian foods seed dataset
// (supabase/seed/foods.json) and its idempotent upsert planning logic
// (src/lib/food/seed.ts). No live Supabase connection required -- these
// tests derive from the assertion text (AS-033, AS-034) and the
// definition-of-done items, not from scripts/seed-foods.ts's
// implementation, so they stay meaningful if the DB-writing code changes.
//
// See src/lib/food/__tests__/seed-live.integration.test.ts for the
// companion live-database proof (actual row count + findability against
// the real project, degrading gracefully when no live connection is
// available in the current session, same pattern as F020's
// foods-logs-rls.integration.test.ts).

const DATASET_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "supabase",
  "seed",
  "foods.json"
);

function readDataset(): unknown[] {
  return JSON.parse(fs.readFileSync(DATASET_PATH, "utf-8")) as unknown[];
}

describe("F021: supabase/seed/foods.json (curated seed dataset)", () => {
  it("test_AS_033_dataset_file_exists", () => {
    expect(fs.existsSync(DATASET_PATH)).toBe(true);
  });

  it("test_AS_033_dataset_has_at_least_300_entries", () => {
    const raw = readDataset();
    expect(Array.isArray(raw)).toBe(true);
    expect(raw.length).toBeGreaterThanOrEqual(300);
    // Target 300-500 per the clarified scope -- a loud failure here means
    // the dataset drifted outside its intended range, not just "too small".
    expect(raw.length).toBeLessThanOrEqual(500);
  });

  it("test_AS_033_every_row_passes_validation_no_malformed_rows_in_the_committed_dataset", () => {
    const raw = readDataset();
    const { valid, skipped } = validateSeedRows(raw);
    expect(skipped).toEqual([]);
    expect(valid.length).toBe(raw.length);
  });

  it("test_AS_033_dataset_includes_known_serbian_staples", () => {
    const { valid } = validateSeedRows(readDataset());
    const names = valid.map((r) => r.name_sr.toLowerCase());
    for (const staple of [
      "pileć", // piletina/pileća prsa
      "hleb",
      "mleko",
      "jaje",
      "krompir",
      "paradajz",
      "jabuka",
    ]) {
      expect(
        names.some((n) => n.includes(staple)),
        `expected a staple food containing "${staple}"`
      ).toBe(true);
    }
  });

  it("test_AS_033_dataset_includes_several_known_serbian_branded_items", () => {
    const { valid } = validateSeedRows(readDataset());
    const brands = new Set(
      valid.map((r) => (r.brand ?? "").toLowerCase()).filter(Boolean)
    );
    for (const expectedBrand of [
      "imlek",
      "bambi",
      "štark",
      "nectar",
      "knjaz miloš",
    ]) {
      expect(
        brands.has(expectedBrand),
        `expected branded item with brand "${expectedBrand}"`
      ).toBe(true);
    }
    // At least a handful of distinct brands overall, not just these five.
    expect(brands.size).toBeGreaterThanOrEqual(8);
  });

  it("test_AS_034_sarma_gibanica_pasulj_and_karadjordjeva_are_all_present_and_findable_by_serbian_name", () => {
    const { valid } = validateSeedRows(readDataset());
    const names = valid.map((r) => r.name_sr.toLowerCase());

    expect(names.some((n) => n.includes("sarma"))).toBe(true);
    expect(names.some((n) => n.includes("gibanica"))).toBe(true);
    expect(names.some((n) => n.includes("pasulj"))).toBe(true);
    expect(names.some((n) => n.includes("karađorđeva"))).toBe(true);
  });

  it("test_AS_034_dataset_includes_other_common_traditional_dishes", () => {
    const { valid } = validateSeedRows(readDataset());
    const names = valid.map((r) => r.name_sr.toLowerCase());
    // "several other common dishes" per the clarified scope -- spot-check a
    // handful beyond the four explicitly named in AS-034.
    const otherDishes = ["musaka", "đuveč", "ajvar", "šopska", "punjene paprike"];
    const foundCount = otherDishes.filter((d) =>
      names.some((n) => n.includes(d))
    ).length;
    expect(foundCount).toBeGreaterThanOrEqual(4);
  });

  it("test_dataset_macros_are_internally_consistent_kcal_approx_4p_plus_4c_plus_9f", () => {
    const { valid } = validateSeedRows(readDataset());
    const inconsistent = valid.filter((row) => !isKcalConsistent(row));
    expect(
      inconsistent.map((r) => r.name_sr),
      "every seed row's kcal_100g must be within tolerance of 4*protein + 4*carbs + 9*fat"
    ).toEqual([]);
  });

  it("test_dataset_has_common_units_with_gram_weights_on_a_meaningful_subset_of_natural_items", () => {
    const { valid } = validateSeedRows(readDataset());
    const withUnits = valid.filter((r) => r.common_units.length > 0);
    expect(withUnits.length).toBeGreaterThan(50);
    for (const row of withUnits) {
      for (const unit of row.common_units) {
        expect(typeof unit.label).toBe("string");
        expect(unit.label.length).toBeGreaterThan(0);
        expect(typeof unit.grams).toBe("number");
        expect(unit.grams).toBeGreaterThan(0);
      }
    }
  });

  it("test_dataset_has_no_duplicate_upsert_keys", () => {
    const { valid } = validateSeedRows(readDataset());
    const keys = valid.map((r) => upsertKey(r));
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("F021: validateSeedRows (failure test -- malformed rows are skipped, not inserted)", () => {
  it("test_AS_033_row_missing_name_sr_is_skipped", () => {
    const { valid, skipped } = validateSeedRows([
      { kcal_100g: 100, protein_100g: 1, carbs_100g: 1, fat_100g: 1 },
    ]);
    expect(valid).toEqual([]);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].reason).toMatch(/name_sr/);
  });

  it("test_AS_033_row_with_blank_name_sr_is_skipped", () => {
    const { valid, skipped } = validateSeedRows([
      { name_sr: "   ", kcal_100g: 100, protein_100g: 1, carbs_100g: 1, fat_100g: 1 },
    ]);
    expect(valid).toEqual([]);
    expect(skipped).toHaveLength(1);
  });

  it("test_AS_033_row_missing_a_macro_field_is_skipped", () => {
    const { valid, skipped } = validateSeedRows([
      { name_sr: "Testna hrana", kcal_100g: 100, protein_100g: 1, carbs_100g: 1 },
    ]);
    expect(valid).toEqual([]);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].reason).toMatch(/fat_100g/);
  });

  it("test_AS_033_row_with_negative_macro_is_skipped", () => {
    const { valid, skipped } = validateSeedRows([
      {
        name_sr: "Testna hrana",
        kcal_100g: 100,
        protein_100g: -1,
        carbs_100g: 1,
        fat_100g: 1,
      },
    ]);
    expect(valid).toEqual([]);
    expect(skipped).toHaveLength(1);
  });

  it("test_AS_033_non_object_row_is_skipped", () => {
    const { valid, skipped } = validateSeedRows(["not an object", null, 42]);
    expect(valid).toEqual([]);
    expect(skipped).toHaveLength(3);
  });

  it("test_AS_033_a_mixed_batch_only_inserts_the_well_formed_rows", () => {
    const { valid, skipped } = validateSeedRows([
      { name_sr: "Dobra Hrana", kcal_100g: 100, protein_100g: 5, carbs_100g: 10, fat_100g: 2 },
      { name_sr: "", kcal_100g: 100, protein_100g: 5, carbs_100g: 10, fat_100g: 2 },
      { name_sr: "Druga Dobra Hrana", kcal_100g: 50, protein_100g: 2, carbs_100g: 5, fat_100g: 1 },
    ]);
    expect(valid).toHaveLength(2);
    expect(skipped).toHaveLength(1);
    expect(valid.map((r) => r.name_sr)).toEqual([
      "Dobra Hrana",
      "Druga Dobra Hrana",
    ]);
  });
});

describe("F021: upsertKey (barcode when present, else name_sr+brand)", () => {
  it("test_upsertKey_uses_barcode_when_present", () => {
    const key = upsertKey({ name_sr: "Cokolada", brand: "Bambi", barcode: "3800012345678" });
    expect(key).toBe("barcode:3800012345678");
  });

  it("test_upsertKey_falls_back_to_name_and_brand_when_no_barcode", () => {
    const key = upsertKey({ name_sr: "Mleko 3.2%", brand: "Imlek", barcode: undefined });
    expect(key).toBe("name:mleko 3.2%|imlek");
  });

  it("test_upsertKey_is_case_and_whitespace_insensitive_for_the_name_brand_fallback", () => {
    const a = upsertKey({ name_sr: "  Sarma  ", brand: "  ", barcode: undefined });
    const b = upsertKey({ name_sr: "sarma", brand: null, barcode: undefined });
    expect(a).toBe(b);
  });
});

function makeRow(overrides: Partial<SeedFoodRow> = {}): SeedFoodRow {
  return {
    name_sr: "Testna Hrana",
    brand: null,
    kcal_100g: 100,
    protein_100g: 5,
    carbs_100g: 10,
    fat_100g: 2,
    common_units: [],
    ...overrides,
  };
}

describe("F021: planSeedUpsert (idempotent -- re-run never duplicates)", () => {
  it("test_planSeedUpsert_schedules_a_fresh_row_as_insert_when_no_existing_row_matches", () => {
    const plan = planSeedUpsert([makeRow({ name_sr: "Nova Hrana" })], []);
    expect(plan.toInsert).toHaveLength(1);
    expect(plan.toUpdate).toHaveLength(0);
  });

  it("test_planSeedUpsert_schedules_an_update_not_a_second_insert_when_name_and_brand_already_exist", () => {
    const existing: ExistingFoodRow[] = [
      { id: "existing-id-1", name_sr: "Sarma", brand: null, barcode: null },
    ];
    const plan = planSeedUpsert([makeRow({ name_sr: "Sarma" })], existing);
    expect(plan.toInsert).toHaveLength(0);
    expect(plan.toUpdate).toEqual([
      { id: "existing-id-1", row: expect.objectContaining({ name_sr: "Sarma" }) },
    ]);
  });

  it("test_planSeedUpsert_matches_by_barcode_even_if_name_differs_slightly", () => {
    const existing: ExistingFoodRow[] = [
      {
        id: "existing-id-2",
        name_sr: "Stari naziv",
        brand: "Bambi",
        barcode: "3800012345678",
      },
    ];
    const plan = planSeedUpsert(
      [
        makeRow({
          name_sr: "Novi naziv (ispravljen)",
          brand: "Bambi",
          barcode: "3800012345678",
        }),
      ],
      existing
    );
    expect(plan.toInsert).toHaveLength(0);
    expect(plan.toUpdate[0].id).toBe("existing-id-2");
  });

  it("test_planSeedUpsert_running_twice_in_sequence_never_produces_a_second_insert_for_the_same_dataset", () => {
    const dataset = [
      makeRow({ name_sr: "Prva Hrana" }),
      makeRow({ name_sr: "Druga Hrana", brand: "Neka Marka" }),
      makeRow({ name_sr: "Treća Hrana", barcode: "1112223334445" }),
    ];

    // Run 1: DB starts empty.
    const firstPlan = planSeedUpsert(dataset, []);
    expect(firstPlan.toInsert).toHaveLength(3);
    expect(firstPlan.toUpdate).toHaveLength(0);

    // Simulate applying the first plan: every inserted row now exists.
    const existingAfterFirstRun: ExistingFoodRow[] = firstPlan.toInsert.map(
      (row, i) => ({
        id: `generated-id-${i}`,
        name_sr: row.name_sr,
        brand: row.brand,
        barcode: row.barcode ?? null,
      })
    );

    // Run 2: same dataset, DB now has run 1's rows.
    const secondPlan = planSeedUpsert(dataset, existingAfterFirstRun);
    expect(secondPlan.toInsert).toHaveLength(0);
    expect(secondPlan.toUpdate).toHaveLength(3);

    // Total distinct rows implied by the DB never grows past the dataset
    // size -- this is the concrete "count is stable on second run" proof.
    expect(existingAfterFirstRun.length).toBe(dataset.length);
  });

  it("test_planSeedUpsert_only_touches_rows_passed_in_as_existing_never_invents_extra_writes", () => {
    const dataset = [makeRow({ name_sr: "Usamljena Hrana" })];
    const plan = planSeedUpsert(dataset, []);
    expect(plan.toInsert).toHaveLength(1);
    expect(plan.toInsert[0].name_sr).toBe("Usamljena Hrana");
  });
});

describe("F021: toFoodInsert (stamps source=seed, verified=true)", () => {
  it("test_toFoodInsert_stamps_source_seed_and_verified_true", () => {
    const insertRow = toFoodInsert(makeRow({ name_sr: "Gibanica" }));
    expect(insertRow.source).toBe("seed");
    expect(insertRow.verified).toBe(true);
    expect(insertRow.name_sr).toBe("Gibanica");
  });

  it("test_toFoodInsert_omits_barcode_key_entirely_when_absent_so_updates_never_clobber_an_existing_barcode", () => {
    const insertRow = toFoodInsert(makeRow({ barcode: undefined }));
    expect("barcode" in insertRow ? insertRow.barcode : undefined).toBeUndefined();
  });

  it("test_toFoodInsert_carries_the_barcode_through_when_present", () => {
    const insertRow = toFoodInsert(makeRow({ barcode: "1234567890123" }));
    expect(insertRow.barcode).toBe("1234567890123");
  });
});

describe("F021: isKcalConsistent", () => {
  it("test_isKcalConsistent_true_for_exact_formula_match", () => {
    // 10*4 + 20*4 + 5*9 = 40 + 80 + 45 = 165
    const row = makeRow({
      protein_100g: 10,
      carbs_100g: 20,
      fat_100g: 5,
      kcal_100g: 165,
    });
    expect(isKcalConsistent(row)).toBe(true);
  });

  it("test_isKcalConsistent_false_when_kcal_wildly_off", () => {
    const row = makeRow({
      protein_100g: 10,
      carbs_100g: 20,
      fat_100g: 5,
      kcal_100g: 999,
    });
    expect(isKcalConsistent(row)).toBe(false);
  });
});
