import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.stubGlobal("fetch", vi.fn());

// "Seen once" for meal photos is remembered in localStorage; keep tests
// independent of each other's reveals.
beforeEach(() => window.localStorage.clear());

import { subscribeToAddSheetRequests } from "@/components/home/add-sheet-open";
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

  it("test_AS_049_empty_state_shows_encouraging_serbian_copy_and_an_add_action_when_no_logs_today", () => {
    render(<MealList logs={[]} onSaved={vi.fn()} onDeleted={vi.fn()} />);

    expect(screen.getByTestId("home-meals-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("home-meals-list")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Dodaj unos" })
    ).toBeInTheDocument();
  });

  it("test_the_empty_state_offers_the_whole_menu_not_one_method", () => {
    // It used to link straight to `/dodaj/obrok`, which made the meal photo the
    // silent default for the one person who has logged nothing yet -- exactly
    // the person who most needs to see that Prizma, Gric and the rest exist.
    // Owner's call (2026-08-09): it opens the "+" menu instead.
    const opened = vi.fn();
    const unsubscribe = subscribeToAddSheetRequests(opened);

    try {
      render(<MealList logs={[]} onSaved={vi.fn()} onDeleted={vi.fn()} />);
      fireEvent.click(screen.getByTestId("home-meals-empty-cta"));

      expect(opened).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribe();
    }
  });
});

describe("Slikaj obrok: a meal log with a stored photo shows the photo + macros", () => {
  it("renders the meal photo (served from the API route, alt = meal name) and the macro breakdown", () => {
    const logs = [
      makeLog({
        id: "log-photo",
        name: "Ćevapi",
        protein: 32,
        carbs: 40,
        fat: 18,
        food_id: null,
        food: null,
        hasPhoto: true,
      }),
    ];

    render(<MealList logs={logs} onSaved={vi.fn()} onDeleted={vi.fn()} />);

    const photo = screen.getByTestId("meal-card-photo-log-photo");
    expect(photo).toHaveAttribute("src", "/api/obrok-slika/log-photo");
    expect(photo).toHaveAttribute("alt", "Ćevapi");

    const macros = screen.getByTestId("meal-card-macros-log-photo");
    expect(macros).toHaveTextContent("32 g");
    expect(macros).toHaveTextContent("Proteini");
    expect(macros).toHaveTextContent("UH");
    expect(macros).toHaveTextContent("Masti");
  });

  it("shows no photo or macro row for a log without a stored photo", () => {
    const logs = [makeLog({ id: "log-1", hasPhoto: false })];

    render(<MealList logs={logs} onSaved={vi.fn()} onDeleted={vi.fn()} />);

    expect(
      screen.queryByTestId("meal-card-photo-log-1")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("meal-card-macros-log-1")
    ).not.toBeInTheDocument();
  });

  it("opens a full-screen lightbox of the meal photo on tap, and closes it", () => {
    const logs = [
      makeLog({ id: "log-photo", name: "Ćevapi", food_id: null, food: null, hasPhoto: true }),
    ];

    render(<MealList logs={logs} onSaved={vi.fn()} onDeleted={vi.fn()} />);

    // Closed by default.
    expect(
      screen.queryByTestId("meal-card-photo-overlay-log-photo")
    ).not.toBeInTheDocument();

    // Tapping the photo opens the lightbox with the enlarged shot.
    fireEvent.click(screen.getByTestId("meal-card-photo-button-log-photo"));
    const overlay = screen.getByTestId("meal-card-photo-overlay-log-photo");
    expect(overlay).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: /Ćevapi/ })).toBeInTheDocument();

    // The ✕ closes it again.
    fireEvent.click(screen.getByTestId("meal-card-photo-close-log-photo"));
    expect(
      screen.queryByTestId("meal-card-photo-overlay-log-photo")
    ).not.toBeInTheDocument();
  });

  it("veils the photo until it is first opened, then reveals it and remembers", () => {
    const logs = [
      makeLog({ id: "log-veil", name: "Sarma", food_id: null, food: null, hasPhoto: true }),
    ];
    const { rerender } = render(
      <MealList logs={logs} onSaved={vi.fn()} onDeleted={vi.fn()} />
    );

    // Veiled on first sight: the reveal hint is shown.
    expect(screen.getByText("Dodirni da vidiš")).toBeInTheDocument();

    // Opening the photo marks it seen and un-veils it: the hint is gone, and the
    // clear photo stands on its own (no enlarge badge anywhere).
    fireEvent.click(screen.getByTestId("meal-card-photo-button-log-veil"));
    expect(screen.queryByText("Dodirni da vidiš")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("meal-card-expand-log-veil")
    ).not.toBeInTheDocument();

    // And the reveal is remembered across a fresh render (persisted).
    fireEvent.click(screen.getByTestId("meal-card-photo-close-log-veil"));
    rerender(<MealList logs={logs} onSaved={vi.fn()} onDeleted={vi.fn()} />);
    expect(screen.queryByText("Dodirni da vidiš")).not.toBeInTheDocument();
  });
});
