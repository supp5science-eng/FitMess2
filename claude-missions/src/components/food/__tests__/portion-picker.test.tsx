import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// F025 / AS-041, AS-042: component-level coverage of the portion picker's
// live-preview + confirm flow. The live DB write is covered separately by
// `src/app/api/logs/__tests__/route.integration.test.ts`; this file proves
// the UI resolves grams/units to the exact same numbers before ever POSTing.

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { PortionPicker } from "@/components/food/portion-picker";
import type { Food } from "@/lib/types/db";

function makeFood(overrides: Partial<Food> = {}): Food {
  return {
    id: "food-1",
    name_sr: "Jabuka",
    brand: null,
    kcal_100g: 200,
    protein_100g: 10,
    carbs_100g: 20,
    fat_100g: 5,
    common_units: [],
    source: "seed",
    verified: true,
    barcode: null,
    submitted_by: null,
    label_photo_path: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body };
}

beforeEach(() => {
  pushMock.mockClear();
  vi.stubGlobal("fetch", vi.fn());
});

describe("F025 / AS-041: PortionPicker grams-entry live preview", () => {
  it("test_AS_041_the_default_100_gram_entry_previews_exactly_the_per_100g_values", () => {
    render(<PortionPicker food={makeFood()} />);

    expect(screen.getByTestId("portion-preview-kcal")).toHaveTextContent("200");
    expect(screen.getByTestId("portion-preview-protein")).toHaveTextContent("10");
    expect(screen.getByTestId("portion-preview-carbs")).toHaveTextContent("20");
    expect(screen.getByTestId("portion-preview-fat")).toHaveTextContent("5");
  });

  it("test_AS_041_changing_the_gram_amount_live_updates_the_preview_from_per_100g_values", () => {
    render(<PortionPicker food={makeFood()} />);

    fireEvent.change(screen.getByTestId("portion-grams-input"), {
      target: { value: "50" },
    });

    expect(screen.getByTestId("portion-preview-kcal")).toHaveTextContent("100");
    expect(screen.getByTestId("portion-preview-protein")).toHaveTextContent("5");
  });

  it("test_AS_041_confirming_posts_the_entered_grams_and_navigates_home_on_success", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ ok: true, data: { id: "log-1" } })
    );

    render(<PortionPicker food={makeFood()} />);
    fireEvent.change(screen.getByTestId("portion-grams-input"), {
      target: { value: "150" },
    });
    fireEvent.click(screen.getByTestId("portion-confirm-button"));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/danas"));

    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/logs",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ foodId: "food-1", grams: 150, method: "search" }),
      })
    );
  });

  it("test_AS_041_a_failed_save_shows_a_serbian_error_and_does_not_navigate", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ ok: false, error_sr: "Nismo uspeli da sačuvamo unos. Pokušaj ponovo." }, false)
    );

    render(<PortionPicker food={makeFood()} />);
    fireEvent.click(screen.getByTestId("portion-confirm-button"));

    await waitFor(() =>
      expect(screen.getByTestId("portion-error")).toBeInTheDocument()
    );
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("test_a_zero_gram_entry_disables_the_confirm_button", () => {
    render(<PortionPicker food={makeFood()} />);

    fireEvent.change(screen.getByTestId("portion-grams-input"), {
      target: { value: "0" },
    });

    expect(screen.getByTestId("portion-confirm-button")).toBeDisabled();
  });
});

describe("F025 / AS-042: PortionPicker common-unit selection", () => {
  it("test_AS_042_selecting_a_common_unit_previews_macros_for_that_units_gram_weight", () => {
    const food = makeFood({
      common_units: [{ label: "parče", grams: 50 }],
    });
    render(<PortionPicker food={food} />);

    fireEvent.click(screen.getByTestId("portion-unit-chip-0"));

    // Default quantity is 1 -> 50g -> kcal 200*0.5=100
    expect(screen.getByTestId("portion-preview-kcal")).toHaveTextContent("100");
  });

  it("test_AS_042_increasing_the_quantity_multiplies_the_units_gram_weight", () => {
    const food = makeFood({
      common_units: [{ label: "parče", grams: 50 }],
    });
    render(<PortionPicker food={food} />);

    fireEvent.click(screen.getByTestId("portion-unit-chip-0"));
    fireEvent.change(screen.getByTestId("portion-quantity-input"), {
      target: { value: "2" },
    });

    // 2 x 50g = 100g -> kcal 200
    expect(screen.getByTestId("portion-preview-kcal")).toHaveTextContent("200");
  });

  it("test_AS_042_confirming_a_unit_selection_posts_the_resolved_grams_not_the_raw_unit", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ ok: true, data: { id: "log-1" } })
    );
    const food = makeFood({
      common_units: [{ label: "parče", grams: 50 }],
    });
    render(<PortionPicker food={food} />);

    fireEvent.click(screen.getByTestId("portion-unit-chip-0"));
    fireEvent.change(screen.getByTestId("portion-quantity-input"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByTestId("portion-confirm-button"));

    await waitFor(() => expect(pushMock).toHaveBeenCalled());

    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/logs",
      expect.objectContaining({
        body: JSON.stringify({ foodId: "food-1", grams: 100, method: "search" }),
      })
    );
  });

  it("test_a_food_with_no_common_units_shows_no_unit_chips", () => {
    render(<PortionPicker food={makeFood({ common_units: [] })} />);

    expect(screen.queryByTestId("portion-unit-chips")).not.toBeInTheDocument();
  });
});
