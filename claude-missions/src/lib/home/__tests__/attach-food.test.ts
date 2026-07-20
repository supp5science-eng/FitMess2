import { describe, expect, it } from "vitest";

import { attachFoodToLogs } from "@/lib/home/attach-food";
import type { Food, Log } from "@/lib/types/db";

function makeLog(overrides: Partial<Log> = {}): Log {
  return {
    id: "log-1",
    user_id: "user-1",
    food_id: "food-1",
    name: "Jabuka",
    grams: 150,
    kcal: 78,
    protein: 0.4,
    carbs: 20.6,
    fat: 0.3,
    logged_at: "2026-07-17T10:00:00.000Z",
    method: "search",
    created_at: "2026-07-17T10:00:00.000Z",
    ...overrides,
  };
}

function makeFood(overrides: Partial<Food> = {}): Food {
  return {
    id: "food-1",
    name_sr: "Jabuka",
    brand: null,
    kcal_100g: 52,
    protein_100g: 0.3,
    carbs_100g: 13.8,
    fat_100g: 0.2,
    common_units: [],
    source: "seed",
    verified: true,
    is_default: false,
    barcode: null,
    submitted_by: null,
    label_photo_path: null,
    price: null,
    is_removed: false,
    removed_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("F027: attachFoodToLogs -- AS-049 today's-meals join", () => {
  it("attaches the matching food row to each log", () => {
    const logs = [makeLog({ id: "log-1", food_id: "food-1" })];
    const foods = [makeFood({ id: "food-1", name_sr: "Jabuka" })];

    const result = attachFoodToLogs(logs, foods);

    expect(result).toHaveLength(1);
    expect(result[0]?.food?.name_sr).toBe("Jabuka");
    expect(result[0]?.id).toBe("log-1");
  });

  it("resolves to food: null when a log's food_id is null", () => {
    const logs = [makeLog({ id: "log-2", food_id: null })];

    const result = attachFoodToLogs(logs, []);

    expect(result[0]?.food).toBeNull();
  });

  it("resolves to food: null when the referenced food is not in the foods list (deleted/missing)", () => {
    const logs = [makeLog({ id: "log-3", food_id: "food-missing" })];

    const result = attachFoodToLogs(logs, [makeFood({ id: "food-1" })]);

    expect(result[0]?.food).toBeNull();
  });

  it("preserves log order and count for a mixed list", () => {
    const logs = [
      makeLog({ id: "log-a", food_id: "food-1" }),
      makeLog({ id: "log-b", food_id: null }),
      makeLog({ id: "log-c", food_id: "food-2" }),
    ];
    const foods = [makeFood({ id: "food-1" }), makeFood({ id: "food-2" })];

    const result = attachFoodToLogs(logs, foods);

    expect(result.map((l) => l.id)).toEqual(["log-a", "log-b", "log-c"]);
    expect(result[1]?.food).toBeNull();
  });
});
