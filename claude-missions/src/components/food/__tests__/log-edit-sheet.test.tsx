import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// F026 / AS-044: component-level coverage of the reusable edit sheet's
// pre-load + live-preview + save flow. The live DB write is covered
// separately by
// `src/app/api/logs/[id]/__tests__/route.integration.test.ts`; this file
// proves the UI pre-loads the existing entry and resolves grams/units to
// the exact same numbers before ever PATCHing.

vi.stubGlobal("fetch", vi.fn());

import { LogEditSheet } from "@/components/food/log-edit-sheet";
import type { Food, Log } from "@/lib/types/db";

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
    is_removed: false,
    removed_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeUpdatedLog(overrides: Partial<Log> = {}): Log {
  return {
    id: "log-1",
    user_id: "user-1",
    food_id: "food-1",
    name: "Jabuka",
    grams: 150,
    kcal: 300,
    protein: 15,
    carbs: 30,
    fat: 7.5,
    logged_at: "2026-01-01T00:00:00.000Z",
    method: "search",
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body };
}

beforeEach(() => {
  (global.fetch as ReturnType<typeof vi.fn>).mockReset();
});

describe("F026 / AS-044: LogEditSheet is closed by default", () => {
  it("test_AS_044_only_the_izmeni_trigger_is_visible_until_opened", () => {
    render(<LogEditSheet log={{ id: "log-1", grams: 100 }} food={makeFood()} />);

    expect(screen.getByTestId("log-edit-open-button")).toBeInTheDocument();
    expect(screen.queryByTestId("log-edit-sheet")).not.toBeInTheDocument();
  });
});

describe("F026 / AS-044: LogEditSheet pre-loads the existing entry's portion", () => {
  it("test_AS_044_opening_pre_fills_the_grams_input_with_the_entrys_current_grams", () => {
    render(<LogEditSheet log={{ id: "log-1", grams: 175 }} food={makeFood()} />);

    fireEvent.click(screen.getByTestId("log-edit-open-button"));

    expect(screen.getByTestId("log-edit-grams-input")).toHaveValue(175);
    // Preview reflects the pre-loaded grams immediately (200*1.75=350).
    expect(screen.getByTestId("log-edit-preview-kcal")).toHaveTextContent("350");
  });

  it("test_AS_044_opening_an_entry_whose_grams_match_a_common_unit_preselects_that_unit_and_quantity", () => {
    const food = makeFood({ common_units: [{ label: "parče", grams: 50 }] });
    // 100g == 2 x 50g "parče"
    render(<LogEditSheet log={{ id: "log-1", grams: 100 }} food={food} />);

    fireEvent.click(screen.getByTestId("log-edit-open-button"));

    expect(screen.getByTestId("log-edit-unit-chip-0")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByTestId("log-edit-quantity-input")).toHaveValue(2);
  });
});

describe("F026 / AS-044: LogEditSheet live preview + save", () => {
  it("test_AS_044_changing_the_gram_amount_live_updates_the_preview", () => {
    render(<LogEditSheet log={{ id: "log-1", grams: 100 }} food={makeFood()} />);
    fireEvent.click(screen.getByTestId("log-edit-open-button"));

    fireEvent.change(screen.getByTestId("log-edit-grams-input"), {
      target: { value: "50" },
    });

    expect(screen.getByTestId("log-edit-preview-kcal")).toHaveTextContent("100");
  });

  it("test_AS_044_saving_PATCHes_the_resolved_grams_to_the_correct_log_id_and_calls_onSaved", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ ok: true, data: makeUpdatedLog() })
    );
    const onSaved = vi.fn();

    render(
      <LogEditSheet
        log={{ id: "log-42", grams: 100 }}
        food={makeFood()}
        onSaved={onSaved}
      />
    );
    fireEvent.click(screen.getByTestId("log-edit-open-button"));
    fireEvent.change(screen.getByTestId("log-edit-grams-input"), {
      target: { value: "150" },
    });
    fireEvent.click(screen.getByTestId("log-edit-save-button"));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());

    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/logs/log-42",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ grams: 150 }),
      })
    );
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ grams: 150 }));
    // Sheet closes on success.
    await waitFor(() =>
      expect(screen.queryByTestId("log-edit-sheet")).not.toBeInTheDocument()
    );
  });

  it("test_AS_044_selecting_a_common_unit_and_saving_PATCHes_the_units_resolved_grams", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ ok: true, data: makeUpdatedLog({ grams: 100 }) })
    );
    const food = makeFood({ common_units: [{ label: "parče", grams: 50 }] });

    render(<LogEditSheet log={{ id: "log-1", grams: 100 }} food={food} />);
    fireEvent.click(screen.getByTestId("log-edit-open-button"));
    fireEvent.click(screen.getByTestId("log-edit-unit-chip-0"));
    fireEvent.change(screen.getByTestId("log-edit-quantity-input"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByTestId("log-edit-save-button"));

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/logs/log-1",
      expect.objectContaining({ body: JSON.stringify({ grams: 100 }) })
    );
  });

  it("test_AS_044_a_failed_save_shows_a_serbian_error_and_the_sheet_stays_open_for_retry", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ ok: false, error_sr: "Nismo uspeli da izmenimo unos. Pokušaj ponovo." }, false)
    );
    const onSaved = vi.fn();

    render(
      <LogEditSheet log={{ id: "log-1", grams: 100 }} food={makeFood()} onSaved={onSaved} />
    );
    fireEvent.click(screen.getByTestId("log-edit-open-button"));
    fireEvent.click(screen.getByTestId("log-edit-save-button"));

    await waitFor(() =>
      expect(screen.getByTestId("log-edit-error")).toBeInTheDocument()
    );
    expect(onSaved).not.toHaveBeenCalled();
    // Retry affordance: the sheet + save button are still there.
    expect(screen.getByTestId("log-edit-sheet")).toBeInTheDocument();
    expect(screen.getByTestId("log-edit-save-button")).not.toBeDisabled();
  });

  it("test_a_zero_gram_entry_disables_the_save_button", () => {
    render(<LogEditSheet log={{ id: "log-1", grams: 100 }} food={makeFood()} />);
    fireEvent.click(screen.getByTestId("log-edit-open-button"));

    fireEvent.change(screen.getByTestId("log-edit-grams-input"), {
      target: { value: "0" },
    });

    expect(screen.getByTestId("log-edit-save-button")).toBeDisabled();
  });

  it("test_canceling_closes_the_sheet_without_calling_fetch", () => {
    render(<LogEditSheet log={{ id: "log-1", grams: 100 }} food={makeFood()} />);
    fireEvent.click(screen.getByTestId("log-edit-open-button"));
    fireEvent.click(screen.getByTestId("log-edit-cancel-button"));

    expect(screen.queryByTestId("log-edit-sheet")).not.toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("test_reopening_after_a_cancel_resets_the_form_back_to_the_entrys_current_grams", () => {
    render(<LogEditSheet log={{ id: "log-1", grams: 100 }} food={makeFood()} />);
    fireEvent.click(screen.getByTestId("log-edit-open-button"));
    fireEvent.change(screen.getByTestId("log-edit-grams-input"), {
      target: { value: "999" },
    });
    fireEvent.click(screen.getByTestId("log-edit-cancel-button"));

    fireEvent.click(screen.getByTestId("log-edit-open-button"));
    expect(screen.getByTestId("log-edit-grams-input")).toHaveValue(100);
  });
});

describe("AS-128: LogEditSheet inputs are labeled and interactive elements are keyboard-reachable", () => {
  it("test_AS_128_the_grams_input_has_an_accessible_label_findable_by_its_text", () => {
    render(<LogEditSheet log={{ id: "log-1", grams: 100 }} food={makeFood()} />);
    fireEvent.click(screen.getByTestId("log-edit-open-button"));

    // `getByLabelText` only succeeds when a real, associated <label> (here
    // `<Label htmlFor="log-edit-grams-input">Količina u gramima</Label>`)
    // points at the input -- a placeholder alone would not satisfy this.
    const input = screen.getByLabelText("Količina u gramima");
    expect(input).toBe(screen.getByTestId("log-edit-grams-input"));
    expect(input.tagName).toBe("INPUT");
  });

  it("test_AS_128_the_quantity_input_has_an_accessible_label_when_a_unit_is_selected", () => {
    const food = makeFood({ common_units: [{ label: "parče", grams: 50 }] });
    render(<LogEditSheet log={{ id: "log-1", grams: 50 }} food={food} />);
    fireEvent.click(screen.getByTestId("log-edit-open-button"));

    const input = screen.getByLabelText("Količina");
    expect(input).toBe(screen.getByTestId("log-edit-quantity-input"));
  });

  it("test_AS_128_the_save_cancel_and_unit_chip_controls_are_real_keyboard_reachable_button_elements", () => {
    const food = makeFood({ common_units: [{ label: "parče", grams: 50 }] });
    render(<LogEditSheet log={{ id: "log-1", grams: 100 }} food={food} />);
    fireEvent.click(screen.getByTestId("log-edit-open-button"));

    for (const testId of [
      "log-edit-save-button",
      "log-edit-cancel-button",
      "log-edit-unit-chip-0",
    ]) {
      const el = screen.getByTestId(testId);
      // A native <button> with no explicit negative tabindex is keyboard
      // (Tab) reachable by default, activatable via Enter/Space.
      expect(el.tagName).toBe("BUTTON");
      expect(el).not.toHaveAttribute("tabindex", "-1");
    }
  });

  it("test_AS_128_the_edit_sheet_renders_no_bare_images_without_alt_text", () => {
    const food = makeFood({ common_units: [{ label: "parče", grams: 50 }] });
    render(<LogEditSheet log={{ id: "log-1", grams: 100 }} food={food} />);
    fireEvent.click(screen.getByTestId("log-edit-open-button"));

    // This sheet renders no <img> elements at all (everything is text) --
    // so there is nothing that could be missing alt text. Asserted
    // explicitly rather than assumed.
    const images = screen.getByTestId("log-edit-sheet").querySelectorAll("img");
    expect(images.length).toBe(0);
  });
});
