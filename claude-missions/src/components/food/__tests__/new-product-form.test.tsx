import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// F032 / AS-055 (a barcode miss offers a first-time entry form pre-filled
// with the scanned GTIN), AS-057 (a duplicate barcode is rejected with a
// friendly Serbian message, never a crash): component-level coverage of
// `NewProductForm`. The live-DB create/RLS/unique-constraint behaviour
// itself (AS-056, AS-057) is covered separately by
// `src/app/api/foods/__tests__/route.integration.test.ts`; this file proves
// the UI renders the right pre-filled/validation/error states and posts
// the right request.

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { NewProductForm } from "@/components/food/new-product-form";
import type { Food } from "@/lib/types/db";

function makeFood(overrides: Partial<Food> = {}): Food {
  return {
    id: "food-new-1",
    name_sr: "Domaći ajvar",
    brand: null,
    kcal_100g: 250,
    protein_100g: 2,
    carbs_100g: 10,
    fat_100g: 20,
    common_units: [],
    source: "user",
    verified: false,
    is_default: false,
    barcode: null,
    submitted_by: "user-a",
    label_photo_path: null,
    is_removed: false,
    removed_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body };
}

function fillValidForm() {
  fireEvent.change(screen.getByTestId("novi-proizvod-name-input"), {
    target: { value: "Domaći ajvar" },
  });
  fireEvent.change(screen.getByTestId("novi-proizvod-kcal-input"), {
    target: { value: "250" },
  });
  fireEvent.change(screen.getByTestId("novi-proizvod-protein-input"), {
    target: { value: "2" },
  });
  fireEvent.change(screen.getByTestId("novi-proizvod-carbs-input"), {
    target: { value: "10" },
  });
  fireEvent.change(screen.getByTestId("novi-proizvod-fat-input"), {
    target: { value: "20" },
  });
}

beforeEach(() => {
  pushMock.mockClear();
  vi.stubGlobal("fetch", vi.fn());
});

describe("F032 / AS-055: NewProductForm pre-fills the scanned GTIN", () => {
  it("test_AS_055_the_barcode_field_is_prefilled_with_the_scanned_gtin", () => {
    render(<NewProductForm initialBarcode="5901234123457" />);

    expect(screen.getByTestId("novi-proizvod-barcode-input")).toHaveValue(
      "5901234123457"
    );
  });

  it("test_AS_055_the_barcode_field_is_still_editable_after_being_prefilled", () => {
    render(<NewProductForm initialBarcode="5901234123457" />);

    fireEvent.change(screen.getByTestId("novi-proizvod-barcode-input"), {
      target: { value: "5901234000005" },
    });

    expect(screen.getByTestId("novi-proizvod-barcode-input")).toHaveValue(
      "5901234000005"
    );
  });

  it("test_a_missing_gtin_renders_the_form_with_an_empty_barcode_field_no_crash", () => {
    render(<NewProductForm />);

    expect(screen.getByTestId("novi-proizvod-barcode-input")).toHaveValue("");
    expect(screen.getByTestId("novi-proizvod-form")).toBeInTheDocument();
  });
});

describe("F032: NewProductForm client-side validation", () => {
  it("test_submitting_without_a_name_shows_an_inline_serbian_field_error_and_does_not_post", () => {
    render(<NewProductForm />);
    fireEvent.change(screen.getByTestId("novi-proizvod-kcal-input"), {
      target: { value: "250" },
    });
    fireEvent.change(screen.getByTestId("novi-proizvod-protein-input"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByTestId("novi-proizvod-carbs-input"), {
      target: { value: "10" },
    });
    fireEvent.change(screen.getByTestId("novi-proizvod-fat-input"), {
      target: { value: "20" },
    });

    fireEvent.click(screen.getByTestId("novi-proizvod-submit-button"));

    expect(
      screen.getByTestId("novi-proizvod-name-input-error")
    ).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("test_an_insane_kcal_value_shows_an_inline_serbian_field_error_and_does_not_post", () => {
    render(<NewProductForm />);
    fillValidForm();
    fireEvent.change(screen.getByTestId("novi-proizvod-kcal-input"), {
      target: { value: "5000" },
    });

    fireEvent.click(screen.getByTestId("novi-proizvod-submit-button"));

    expect(
      screen.getByTestId("novi-proizvod-kcal-input-error")
    ).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe("F032: NewProductForm save flow", () => {
  it("test_a_successful_save_posts_the_validated_entry_to_api_foods", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ ok: true, data: makeFood() })
    );

    render(<NewProductForm initialBarcode="5901234123457" />);
    fillValidForm();
    fireEvent.click(screen.getByTestId("novi-proizvod-submit-button"));

    await waitFor(() =>
      expect(screen.getByTestId("portion-picker")).toBeInTheDocument()
    );

    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/foods",
      expect.objectContaining({ method: "POST" })
    );
    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const sentBody = JSON.parse(requestInit.body as string);
    expect(sentBody).toEqual({
      name_sr: "Domaći ajvar",
      kcal_100g: 250,
      protein_100g: 2,
      carbs_100g: 10,
      fat_100g: 20,
      barcode: "5901234123457",
    });
  });

  it("test_after_a_successful_save_the_portion_picker_is_shown_for_the_new_food_with_method_barcode_when_a_barcode_was_attached", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ ok: true, data: makeFood({ barcode: "5901234123457" }) })
    );

    render(<NewProductForm initialBarcode="5901234123457" />);
    fillValidForm();
    fireEvent.click(screen.getByTestId("novi-proizvod-submit-button"));

    await waitFor(() =>
      expect(screen.getByTestId("portion-picker")).toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId("portion-confirm-button"));

    await waitFor(() => {
      const logFetchCall = (
        global.fetch as ReturnType<typeof vi.fn>
      ).mock.calls.find(([url]) => url === "/api/logs");
      expect(logFetchCall).toBeDefined();
    });
    const logFetchCall = (
      global.fetch as ReturnType<typeof vi.fn>
    ).mock.calls.find(([url]) => url === "/api/logs") as [string, RequestInit];
    const sentBody = JSON.parse(logFetchCall[1].body as string);
    expect(sentBody.method).toBe("barcode");
  });

  it("test_a_generic_save_failure_shows_a_serbian_error_and_never_a_blank_screen", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse(
        { ok: false, error_sr: "Nismo uspeli da sačuvamo proizvod. Pokušaj ponovo." },
        false
      )
    );

    render(<NewProductForm />);
    fillValidForm();
    fireEvent.click(screen.getByTestId("novi-proizvod-submit-button"));

    await waitFor(() =>
      expect(screen.getByTestId("novi-proizvod-error")).toBeInTheDocument()
    );
    expect(screen.getByTestId("novi-proizvod-form")).toBeInTheDocument();
  });

  it("test_AS_057_a_duplicate_barcode_rejection_shows_a_serbian_error_and_a_link_to_the_existing_product_never_a_crash", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse(
        {
          ok: false,
          error_sr: "Proizvod sa ovim barkodom već postoji u bazi.",
          existingFoodId: "existing-food-1",
        },
        false
      )
    );

    render(<NewProductForm initialBarcode="5901234123457" />);
    fillValidForm();
    fireEvent.click(screen.getByTestId("novi-proizvod-submit-button"));

    await waitFor(() =>
      expect(
        screen.getByTestId("novi-proizvod-duplicate-error")
      ).toBeInTheDocument()
    );
    expect(screen.getByText(/već postoji/i)).toBeInTheDocument();

    const openExisting = screen.getByTestId("novi-proizvod-open-existing");
    expect(openExisting).toHaveAttribute(
      "href",
      "/dodaj/porcija/existing-food-1"
    );
    // Still a real, usable form -- never a crash/blank screen.
    expect(screen.getByTestId("novi-proizvod-form")).toBeInTheDocument();
  });

  it("test_a_network_failure_during_save_shows_a_serbian_error_not_a_crash", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("network down")
    );

    render(<NewProductForm />);
    fillValidForm();
    fireEvent.click(screen.getByTestId("novi-proizvod-submit-button"));

    await waitFor(() =>
      expect(screen.getByTestId("novi-proizvod-error")).toBeInTheDocument()
    );
  });
});

describe("F032 / AS-128: NewProductForm accessibility -- labeled inputs, keyboard-reachable, no unlabeled images", () => {
  it("test_AS_128_every_form_field_has_a_real_accessible_label", () => {
    render(<NewProductForm initialBarcode="5901234123457" />);

    // `getByLabelText` only succeeds when an <input> is programmatically
    // associated with a <label> (htmlFor/id, exactly what `FormField`
    // wires up) -- a failing query here would mean a field is NOT
    // actually labeled for a screen reader, not just visually adjacent to
    // text that looks like a label.
    expect(screen.getByLabelText("Naziv namirnice")).toBe(
      screen.getByTestId("novi-proizvod-name-input")
    );
    expect(screen.getByLabelText("Brend (opciono)")).toBe(
      screen.getByTestId("novi-proizvod-brand-input")
    );
    expect(screen.getByLabelText("Barkod (opciono)")).toBe(
      screen.getByTestId("novi-proizvod-barcode-input")
    );
    expect(screen.getByLabelText("Kalorije (kcal)")).toBe(
      screen.getByTestId("novi-proizvod-kcal-input")
    );
    expect(screen.getByLabelText("Proteini (g)")).toBe(
      screen.getByTestId("novi-proizvod-protein-input")
    );
    expect(screen.getByLabelText("Ugljeni hidrati (g)")).toBe(
      screen.getByTestId("novi-proizvod-carbs-input")
    );
    expect(screen.getByLabelText("Masti (g)")).toBe(
      screen.getByTestId("novi-proizvod-fat-input")
    );
  });

  it("test_AS_128_a_field_error_is_programmatically_associated_via_aria_describedby_and_announced_as_an_alert", () => {
    render(<NewProductForm />);
    fireEvent.click(screen.getByTestId("novi-proizvod-submit-button"));

    const nameInput = screen.getByTestId("novi-proizvod-name-input");
    const errorEl = screen.getByTestId("novi-proizvod-name-input-error");

    expect(nameInput).toHaveAttribute("aria-invalid", "true");
    expect(nameInput.getAttribute("aria-describedby")).toBe(errorEl.id);
    expect(errorEl).toHaveAttribute("role", "alert");
  });

  it("test_AS_128_every_interactive_control_is_a_real_focusable_element_not_a_div_click_handler", () => {
    render(<NewProductForm initialBarcode="5901234123457" />);

    // Real <input>/<button> elements are keyboard-reachable (Tab/Shift+Tab,
    // Enter/Space to activate) by native browser behaviour -- no `tabIndex`
    // hacks or non-interactive elements with click handlers are used here.
    for (const testId of [
      "novi-proizvod-name-input",
      "novi-proizvod-brand-input",
      "novi-proizvod-barcode-input",
      "novi-proizvod-kcal-input",
      "novi-proizvod-protein-input",
      "novi-proizvod-carbs-input",
      "novi-proizvod-fat-input",
    ]) {
      expect(screen.getByTestId(testId).tagName).toBe("INPUT");
    }
    expect(screen.getByTestId("novi-proizvod-submit-button").tagName).toBe(
      "BUTTON"
    );
    expect(screen.getByTestId("novi-proizvod-submit-button")).toHaveAttribute(
      "type",
      "submit"
    );
  });

  it("test_AS_128_the_form_renders_no_unlabeled_images", () => {
    const { container } = render(
      <NewProductForm initialBarcode="5901234123457" />
    );

    // This form is text/input-only (no photos/icons rendered as <img>) --
    // confirming that explicitly rather than assuming it, so a future
    // change that DOES add an <img> is forced to also add real alt text
    // (this test would then need an accompanying alt-text assertion).
    const images = container.querySelectorAll("img");
    expect(images.length).toBe(0);
  });
});
