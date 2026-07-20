import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.stubGlobal("fetch", vi.fn());

import { MealList } from "@/components/home/meal-list";
import type { LogWithFood } from "@/lib/home/attach-food";
import type { Food } from "@/lib/types/db";

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

function makeLog(overrides: Partial<LogWithFood> = {}): LogWithFood {
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
    food: makeFood(),
    ...overrides,
  };
}

describe("AS-049: MealList lists today's logged meals", () => {
  it("test_AS_049_renders_a_card_per_log_with_name_portion_and_kcal", () => {
    const logs = [
      makeLog({ id: "log-1", name: "Jabuka", grams: 150, kcal: 78 }),
      makeLog({
        id: "log-2",
        name: "Pileća prsa",
        grams: 200,
        kcal: 330,
        food_id: "food-2",
        food: makeFood({ id: "food-2", name_sr: "Pileća prsa" }),
      }),
    ];

    render(<MealList logs={logs} onSaved={vi.fn()} onDeleted={vi.fn()} />);

    expect(screen.getByTestId("home-meals-list")).toBeInTheDocument();
    expect(screen.getByTestId("meal-card-name-log-1")).toHaveTextContent(
      "Jabuka"
    );
    expect(screen.getByTestId("meal-card-portion-log-1")).toHaveTextContent(
      "150 g"
    );
    expect(screen.getByTestId("meal-card-kcal-log-1")).toHaveTextContent(
      "78 kcal"
    );
    expect(screen.getByTestId("meal-card-name-log-2")).toHaveTextContent(
      "Pileća prsa"
    );
  });

  it("test_AS_049_a_matched_common_unit_portion_shows_the_unit_label_alongside_grams", () => {
    const food = makeFood({
      id: "food-1",
      common_units: [{ label: "parče", grams: 50 }],
    });
    const logs = [
      makeLog({ id: "log-1", grams: 100, food_id: "food-1", food }),
    ];

    render(<MealList logs={logs} onSaved={vi.fn()} onDeleted={vi.fn()} />);

    expect(screen.getByTestId("meal-card-portion-log-1")).toHaveTextContent(
      "parče"
    );
  });

  it("test_AS_049_wires_the_edit_and_delete_controls_from_F026_onto_each_card", () => {
    const logs = [makeLog({ id: "log-1" })];

    render(<MealList logs={logs} onSaved={vi.fn()} onDeleted={vi.fn()} />);

    expect(screen.getByTestId("log-edit-open-button")).toBeInTheDocument();
    expect(screen.getByTestId("log-delete-open-button")).toBeInTheDocument();
  });

  it("test_AS_049_a_log_whose_food_was_deleted_hides_the_edit_control_but_still_offers_delete", () => {
    const logs = [makeLog({ id: "log-1", food_id: null, food: null })];

    render(<MealList logs={logs} onSaved={vi.fn()} onDeleted={vi.fn()} />);

    expect(
      screen.queryByTestId("log-edit-open-button")
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("log-delete-open-button")).toBeInTheDocument();
  });

  it("test_AS_049_empty_state_shows_encouraging_serbian_copy_and_a_dodaj_obrok_action_when_no_logs_today", () => {
    render(<MealList logs={[]} onSaved={vi.fn()} onDeleted={vi.fn()} />);

    expect(screen.getByTestId("home-meals-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("home-meals-list")).not.toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Dodaj obrok" });
    expect(link).toHaveAttribute("href", "/dodaj/pretraga");
  });
});
