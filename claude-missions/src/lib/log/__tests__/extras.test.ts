import { describe, expect, it } from "vitest";

import {
  CURATED_EXTRAS,
  EXTRA_FOOD_NAMES,
  extraComponent,
  extraGenitive,
  extraUnitOf,
  orderExtras,
  toExtraFood,
} from "@/lib/log/extras";
import type { Food } from "@/lib/types/db";

// "Nije bilo na slici": the numbers behind a chip come from the catalog, so
// what is worth testing is the resolution around them -- which serving a tap
// means, what a tap contributes, and that a missing/duplicated catalog row
// degrades instead of breaking the sheet.

function food(overrides: Partial<Food> = {}): Food {
  return {
    id: "food-1",
    name_sr: "Majonez",
    brand: null,
    kcal_100g: 687,
    protein_100g: 1.1,
    carbs_100g: 1.6,
    fat_100g: 75,
    common_units: [{ label: "kašika", grams: 15 }],
    source: "seed",
    verified: true,
    is_default: true,
    barcode: null,
    price: null,
    fiber_100g: 0,
    sugar_100g: 1.6,
    sodium_100g: 600,
    sat_fat_100g: 11,
    removed_at: null,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  } as Food;
}

describe("extraUnitOf", () => {
  it("uses the catalog's own first serving", () => {
    expect(extraUnitOf({ common_units: [{ label: "parče", grams: 30 }] })).toEqual({
      label: "parče",
      grams: 30,
    });
  });

  it("falls back to a spoon when the food has no serving", () => {
    expect(extraUnitOf({ common_units: [] })).toEqual({
      label: "kašika",
      grams: 15,
    });
  });

  it("skips a malformed serving rather than offering a zero-gram tap", () => {
    expect(
      extraUnitOf({
        common_units: [
          { label: "", grams: 0 },
          { label: "kašičica", grams: 5 },
        ],
      })
    ).toEqual({ label: "kašičica", grams: 5 });
  });
});

describe("extraComponent", () => {
  it("scales one tap from per-100 g values", () => {
    // One tablespoon of mayonnaise: 15 g of a 687 kcal/100 g food.
    const line = extraComponent(toExtraFood(food()), 1);
    expect(line).toMatchObject({
      naziv: "Majonez",
      grami: 15,
      kcal: 103,
      kom_naziv: "kašika",
      kom_grami: 15,
    });
    expect(line.mast_g).toBeCloseTo(11.3, 1);
  });

  it("keeps the natural unit unscaled so the next tap adds the same amount", () => {
    const line = extraComponent(toExtraFood(food()), 3);
    expect(line.grami).toBe(45);
    expect(line.kom_grami).toBe(15);
  });
});

describe("orderExtras", () => {
  it("returns the curated order, not the order the database replied in", () => {
    const rows = [
      food({ id: "b", name_sr: "Kečap", kcal_100g: 111 }),
      food({ id: "a", name_sr: "Majonez" }),
    ];
    expect(orderExtras(rows).map((extra) => extra.id)).toEqual(["a", "b"]);
  });

  it("skips names the catalog no longer has instead of emitting holes", () => {
    const resolved = orderExtras([food({ id: "a", name_sr: "Majonez" })]);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].name_sr).toBe("Majonez");
  });

  it("keeps one chip per name when the catalog holds duplicates", () => {
    // The seed catalog really does carry two sunflower-oil rows.
    const rows = [
      food({ id: "oil-1", name_sr: "Suncokretovo ulje", kcal_100g: 900 }),
      food({ id: "oil-2", name_sr: "Suncokretovo ulje", kcal_100g: 900 }),
    ];
    expect(orderExtras(rows).map((extra) => extra.id)).toEqual(["oil-1"]);
  });
});

describe("chip presentation", () => {
  it("shortens catalog names that don't fit a chip", () => {
    const extra = toExtraFood(food({ name_sr: "Pavlaka, kisela 18%" }));
    expect(extra.label).toBe("Pavlaka");
    // The full catalog name is still what gets written to the breakdown.
    expect(extra.name_sr).toBe("Pavlaka, kisela 18%");
  });

  it("knows the genitive for every curated extra", () => {
    for (const name of EXTRA_FOOD_NAMES) {
      expect(extraGenitive(name)).toBeTruthy();
    }
    expect(CURATED_EXTRAS).toHaveLength(EXTRA_FOOD_NAMES.length);
  });

  it("has no genitive for a food that came from search", () => {
    expect(extraGenitive("Tartar sos iz pekare")).toBeNull();
    expect(toExtraFood(food({ name_sr: "Trapist sir" })).of).toBeNull();
  });
});
