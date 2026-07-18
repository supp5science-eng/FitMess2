import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// F027 follow-up decision #14 / AS-128: "Keyboard-reachable, labeled inputs,
// alt text" applied to this feature's own new components (Ring, MacroBars,
// MealList/MealCard). F026 already covers AS-128 for the edit/delete
// controls themselves (`log-edit-sheet.test.tsx`/`log-delete-confirm.
// test.tsx`) -- this file covers the NEW surface F027 adds around them.

vi.stubGlobal("fetch", vi.fn());

import { Ring } from "@/components/home/ring";
import { MacroBars } from "@/components/home/macro-bars";
import { MealList } from "@/components/home/meal-list";
import { HomeScreen } from "@/components/home/home-screen";
import type { LogWithFood } from "@/lib/home/attach-food";
import type { Food, Target } from "@/lib/types/db";

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

function makeTarget(overrides: Partial<Target> = {}): Target {
  return {
    id: "target-1",
    user_id: "user-1",
    daily_kcal: 2000,
    protein_g: 150,
    fat_g: 60,
    carbs_g: 200,
    weekly_kcal: 14000,
    goal: "lose",
    goal_weight_kg: 70,
    timeframe_weeks: 12,
    effective_from: "2026-01-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("AS-128: Ring has an accessible name and renders no bare images", () => {
  it("test_AS_128_ring_exposes_a_single_role_img_with_an_accessible_name_and_no_img_elements", () => {
    render(<Ring consumedKcal={500} targetKcal={2000} />);

    const ring = screen.getByRole("img", { name: "Preostalo 1500 kcal" });
    expect(ring).toBeInTheDocument();
    // The SVG itself is presentational (aria-hidden) -- the accessible name
    // lives on the outer role="img" container, not duplicated as an <img>.
    expect(ring.querySelectorAll("img").length).toBe(0);
  });

  it("test_AS_128_ring_accessible_name_updates_for_the_overshoot_state_too", () => {
    render(<Ring consumedKcal={2300} targetKcal={2000} />);
    expect(
      screen.getByRole("img", { name: "Prekoračeno 300 kcal" })
    ).toBeInTheDocument();
  });
});

describe("AS-128: MacroBars renders no bare images", () => {
  it("test_AS_128_macro_bars_render_no_img_elements", () => {
    render(
      <MacroBars
        consumed={{ protein: 50, carbs: 100, fat: 30 }}
        target={{ proteinG: 150, carbsG: 200, fatG: 60 }}
      />
    );
    expect(
      screen.getByTestId("home-macro-bars").querySelectorAll("img").length
    ).toBe(0);
  });
});

describe("AS-128: MealList's empty-state action is a real, keyboard-reachable link", () => {
  it("test_AS_128_dodaj_obrok_is_a_native_anchor_not_a_div_with_a_click_handler", () => {
    render(<MealList logs={[]} onSaved={vi.fn()} onDeleted={vi.fn()} />);

    const link = screen.getByRole("link", { name: "Dodaj obrok" });
    expect(link.tagName).toBe("A");
    expect(link).not.toHaveAttribute("tabindex", "-1");
  });
});

describe("AS-128: MealCard's edit/delete triggers are real, keyboard-reachable buttons", () => {
  it("test_AS_128_meal_card_edit_and_delete_triggers_are_native_button_elements", () => {
    render(
      <MealList logs={[makeLog()]} onSaved={vi.fn()} onDeleted={vi.fn()} />
    );

    for (const testId of ["log-edit-open-button", "log-delete-open-button"]) {
      const el = screen.getByTestId(testId);
      expect(el.tagName).toBe("BUTTON");
      expect(el).not.toHaveAttribute("tabindex", "-1");
    }
  });
});

describe("AS-128: the full HomeScreen renders no bare <img> elements anywhere", () => {
  it("test_AS_128_home_screen_with_data_renders_zero_img_elements", () => {
    render(
      <HomeScreen initialLogs={[makeLog()]} target={makeTarget()} />
    );
    expect(
      screen.getByTestId("home-screen").querySelectorAll("img").length
    ).toBe(0);
  });

  it("test_AS_128_home_screen_empty_and_no_target_states_also_render_zero_img_elements", () => {
    render(<HomeScreen initialLogs={[]} target={null} />);
    expect(
      screen.getByTestId("home-screen").querySelectorAll("img").length
    ).toBe(0);
  });
});
