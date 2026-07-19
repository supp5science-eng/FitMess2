import { describe, expect, it } from "vitest";

import {
  RECENTS_RESULT_LIMIT,
  dedupeFoodIdsByRecency,
  rankResultsWithRecentsFirst,
  reorderFoodsByIds,
} from "@/lib/food/recents";
import type { Food } from "@/lib/types/db";

// F024 / AS-040: pure-logic unit coverage for the "recently used foods rank
// above generic search matches" behaviour, with no DB required. The live-DB
// proof that recents are the user's OWN logs (never another user's) lives
// in `src/app/api/foods/recents/__tests__/route.integration.test.ts`.

function makeFood(overrides: Partial<Food> & { id: string }): Food {
  return {
    name_sr: "Test namirnica",
    brand: null,
    kcal_100g: 100,
    protein_100g: 1,
    carbs_100g: 1,
    fat_100g: 1,
    common_units: [],
    source: "seed",
    verified: true,
    is_default: false,
    barcode: null,
    submitted_by: null,
    label_photo_path: null,
    is_removed: false,
    removed_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("F024: dedupeFoodIdsByRecency", () => {
  it("test_AS_040_returns_distinct_food_ids_in_most_recent_first_order", () => {
    const ordered = dedupeFoodIdsByRecency([
      { food_id: "food-a" },
      { food_id: "food-b" },
      { food_id: "food-a" }, // older duplicate, already seen -- dropped
      { food_id: "food-c" },
    ]);

    expect(ordered).toEqual(["food-a", "food-b", "food-c"]);
  });

  it("test_AS_040_skips_null_food_id_rows", () => {
    const ordered = dedupeFoodIdsByRecency([
      { food_id: null },
      { food_id: "food-a" },
      { food_id: null },
    ]);

    expect(ordered).toEqual(["food-a"]);
  });

  it("test_dedupe_returns_an_empty_array_for_no_logs", () => {
    expect(dedupeFoodIdsByRecency([])).toEqual([]);
  });
});

describe("F024: reorderFoodsByIds", () => {
  it("test_reorders_foods_to_match_the_given_id_order_regardless_of_input_order", () => {
    const foodA = makeFood({ id: "food-a", name_sr: "A" });
    const foodB = makeFood({ id: "food-b", name_sr: "B" });
    const foodC = makeFood({ id: "food-c", name_sr: "C" });

    const reordered = reorderFoodsByIds(
      [foodC, foodA, foodB],
      ["food-b", "food-c", "food-a"]
    );

    expect(reordered.map((f) => f.id)).toEqual(["food-b", "food-c", "food-a"]);
  });

  it("test_reorder_drops_ids_with_no_matching_food_row_instead_of_leaving_a_hole", () => {
    const foodA = makeFood({ id: "food-a" });

    const reordered = reorderFoodsByIds([foodA], ["food-a", "food-deleted"]);

    expect(reordered.map((f) => f.id)).toEqual(["food-a"]);
  });
});

describe("F024 / AS-040: rankResultsWithRecentsFirst", () => {
  it("test_AS_040_a_recent_food_present_in_search_results_is_moved_to_the_top", () => {
    const recentFood = makeFood({ id: "recent-1", name_sr: "Nedavna namirnica" });
    const genericFood1 = makeFood({ id: "generic-1", name_sr: "Generička 1" });
    const genericFood2 = makeFood({ id: "generic-2", name_sr: "Generička 2" });

    // Server-ranked search order: recentFood is NOT first here -- proving
    // the client-side re-rank, not the search API's own ordering, is what
    // moves it to the top.
    const results = [genericFood1, recentFood, genericFood2];

    const ranked = rankResultsWithRecentsFirst(results, ["recent-1"]);

    expect(ranked.map((f) => f.id)).toEqual([
      "recent-1",
      "generic-1",
      "generic-2",
    ]);
  });

  it("test_AS_040_no_recent_food_present_leaves_the_original_search_order_untouched", () => {
    const genericFood1 = makeFood({ id: "generic-1" });
    const genericFood2 = makeFood({ id: "generic-2" });

    const ranked = rankResultsWithRecentsFirst(
      [genericFood1, genericFood2],
      ["recent-not-in-results"]
    );

    expect(ranked.map((f) => f.id)).toEqual(["generic-1", "generic-2"]);
  });

  it("test_AS_040_multiple_recent_matches_preserve_their_own_recency_order_among_themselves", () => {
    const recentNewest = makeFood({ id: "recent-newest" });
    const recentOlder = makeFood({ id: "recent-older" });
    const generic = makeFood({ id: "generic-1" });

    // Search-result order deliberately scrambles the recency order; recency
    // order comes only from `recentFoodIds`.
    const results = [generic, recentOlder, recentNewest];

    const ranked = rankResultsWithRecentsFirst(results, [
      "recent-newest",
      "recent-older",
    ]);

    expect(ranked.map((f) => f.id)).toEqual([
      "recent-newest",
      "recent-older",
      "generic-1",
    ]);
  });

  it("test_an_empty_recent_list_returns_results_unchanged", () => {
    const genericFood1 = makeFood({ id: "generic-1" });
    const results = [genericFood1];

    expect(rankResultsWithRecentsFirst(results, [])).toEqual(results);
  });

  it("test_an_empty_results_list_returns_an_empty_list", () => {
    expect(rankResultsWithRecentsFirst([], ["recent-1"])).toEqual([]);
  });
});

describe("F024: RECENTS_RESULT_LIMIT", () => {
  it("test_recents_list_is_bounded", () => {
    expect(RECENTS_RESULT_LIMIT).toBeGreaterThan(0);
    expect(RECENTS_RESULT_LIMIT).toBeLessThanOrEqual(20);
  });
});
