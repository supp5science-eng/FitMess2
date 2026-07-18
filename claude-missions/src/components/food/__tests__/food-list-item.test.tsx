import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { FoodListItem } from "@/components/food/food-list-item";
import type { Food } from "@/lib/types/db";

// F024 / AS-039: component-level coverage that an unverified food
// (`foods.verified === false`) is visibly marked "neprovereno" in the
// result list, and a verified food shows no such marker.

function makeFood(overrides: Partial<Food> & { id: string }): Food {
  return {
    name_sr: "Jabuka",
    brand: null,
    kcal_100g: 52,
    protein_100g: 0.3,
    carbs_100g: 14,
    fat_100g: 0.2,
    common_units: [],
    source: "seed",
    verified: true,
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

describe("F024 / AS-039: FoodListItem verified/unverified marker", () => {
  it("test_AS_039_an_unverified_food_shows_the_neprovereno_badge", () => {
    const unverifiedFood = makeFood({ id: "unverified-1", verified: false });

    render(<FoodListItem food={unverifiedFood} />);

    const item = screen.getByTestId("food-item-unverified-1");
    expect(item).toHaveTextContent(/neprovereno/i);
    expect(
      screen.getByTestId("food-badge-neprovereno-unverified-1")
    ).toBeInTheDocument();
  });

  it("test_AS_039_a_verified_food_shows_no_neprovereno_badge", () => {
    const verifiedFood = makeFood({ id: "verified-1", verified: true });

    render(<FoodListItem food={verifiedFood} />);

    const item = screen.getByTestId("food-item-verified-1");
    expect(item).not.toHaveTextContent(/neprovereno/i);
    expect(
      screen.queryByTestId("food-badge-neprovereno-verified-1")
    ).not.toBeInTheDocument();
  });

  it("test_AS_039_both_a_verified_and_an_unverified_food_render_correctly_side_by_side", () => {
    const verifiedFood = makeFood({ id: "verified-2", verified: true });
    const unverifiedFood = makeFood({ id: "unverified-2", verified: false });

    render(
      <ul>
        <FoodListItem food={verifiedFood} />
        <FoodListItem food={unverifiedFood} />
      </ul>
    );

    expect(
      screen.queryByTestId("food-badge-neprovereno-verified-2")
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId("food-badge-neprovereno-unverified-2")
    ).toBeInTheDocument();
  });

  it("test_food_item_shows_the_kcal_per_100g_macro_preview", () => {
    const food = makeFood({ id: "kcal-1", kcal_100g: 87.6 });

    render(<FoodListItem food={food} />);

    expect(screen.getByTestId("food-kcal-kcal-1")).toHaveTextContent("88");
  });

  it("test_food_item_shows_a_recent_tag_when_isRecent_is_true", () => {
    const food = makeFood({ id: "recent-1" });

    render(<FoodListItem food={food} isRecent />);

    expect(screen.getByTestId("food-badge-recent-recent-1")).toBeInTheDocument();
  });

  it("test_food_item_shows_no_recent_tag_by_default", () => {
    const food = makeFood({ id: "recent-2" });

    render(<FoodListItem food={food} />);

    expect(
      screen.queryByTestId("food-badge-recent-recent-2")
    ).not.toBeInTheDocument();
  });
});
