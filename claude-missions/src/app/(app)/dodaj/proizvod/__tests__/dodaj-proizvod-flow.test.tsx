import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

// "Dodaj proizvod" flow: barcode-first add-a-catalog-product. The live camera
// (`BarcodeScanner`) is mocked to a single button that emits a GTIN, so these
// tests exercise THIS component's own step logic -- early duplicate check,
// unknown-barcode -> form, save -> success -- without a real camera/decoder
// (those are covered directly in the scanner's own tests).

const GTIN = "5901234123457";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/scan/barcode-scanner", () => ({
  BarcodeScanner: ({
    onDetected,
    title,
  }: {
    onDetected: (code: string) => void;
    title?: string;
  }) => (
    <div data-testid="mock-scanner">
      <span>{title}</span>
      <button type="button" onClick={() => onDetected(GTIN)}>
        emit-gtin
      </button>
    </div>
  ),
}));

vi.mock("../actions", () => ({
  estimateLabelAction: vi.fn(),
}));

import { DodajProizvodFlow } from "../dodaj-proizvod-flow";

function food(overrides: Record<string, unknown> = {}) {
  return {
    id: "food-1",
    name_sr: "Grčki jogurt",
    brand: null,
    kcal_100g: 97,
    protein_100g: 9,
    carbs_100g: 4,
    fat_100g: 5,
    common_units: [],
    source: "user",
    verified: false,
    is_default: false,
    barcode: GTIN,
    price: null,
    submitted_by: "user-a",
    label_photo_path: null,
    is_removed: false,
    removed_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function detect() {
  fireEvent.click(screen.getByRole("button", { name: "emit-gtin" }));
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

describe("Dodaj proizvod flow", () => {
  it("test_the_scan_step_reads_as_add_a_product_not_log_a_scan", () => {
    render(<DodajProizvodFlow />);
    expect(screen.getByText("Dodaj proizvod")).toBeInTheDocument();
  });

  it("test_a_barcode_already_in_the_catalog_offers_the_existing_product_never_a_duplicate_entry", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: food() }),
    });

    render(<DodajProizvodFlow />);
    detect();

    await waitFor(() =>
      expect(screen.getByTestId("dodaj-proizvod-exists")).toBeInTheDocument()
    );
    expect(screen.getByTestId("dodaj-proizvod-open-existing")).toHaveAttribute(
      "href",
      "/dodaj/porcija/food-1"
    );
  });

  it("test_an_unknown_barcode_advances_to_the_prefilled_new_product_form", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: null }),
    });

    render(<DodajProizvodFlow />);
    detect();

    await waitFor(() =>
      expect(screen.getByTestId("dodaj-proizvod-form-step")).toBeInTheDocument()
    );
    expect(screen.getByTestId("dodaj-proizvod-gtin")).toHaveTextContent(GTIN);
    // The barcode landed in the reused form, pre-filled from the scan.
    expect(screen.getByTestId("novi-proizvod-barcode-input")).toHaveValue(GTIN);
  });

  it("test_a_lookup_failure_shows_a_serbian_error_with_a_retry_never_a_blank_screen", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("network down")
    );

    render(<DodajProizvodFlow />);
    detect();

    await waitFor(() =>
      expect(screen.getByTestId("dodaj-proizvod-error")).toBeInTheDocument()
    );
    expect(screen.getByTestId("dodaj-proizvod-error-retry")).toBeInTheDocument();
  });

  it("test_saving_the_new_product_shows_the_success_screen_with_both_next_actions", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string) => {
        if (String(url).includes("/api/foods/barcode/")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ ok: true, data: null }),
          });
        }
        // POST /api/foods -> created row.
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true, data: food({ id: "food-created" }) }),
        });
      }
    );

    render(<DodajProizvodFlow />);
    detect();

    await screen.findByTestId("dodaj-proizvod-form-step");

    fireEvent.change(screen.getByTestId("novi-proizvod-name-input"), {
      target: { value: "Grčki jogurt" },
    });
    fireEvent.change(screen.getByTestId("novi-proizvod-kcal-input"), {
      target: { value: "97" },
    });
    fireEvent.change(screen.getByTestId("novi-proizvod-protein-input"), {
      target: { value: "9" },
    });
    fireEvent.change(screen.getByTestId("novi-proizvod-carbs-input"), {
      target: { value: "4" },
    });
    fireEvent.change(screen.getByTestId("novi-proizvod-fat-input"), {
      target: { value: "5" },
    });

    fireEvent.click(screen.getByTestId("novi-proizvod-submit-button"));

    await waitFor(() =>
      expect(screen.getByTestId("dodaj-proizvod-success")).toBeInTheDocument()
    );
    expect(screen.getByTestId("dodaj-proizvod-add-another")).toBeInTheDocument();
    expect(screen.getByTestId("dodaj-proizvod-done")).toHaveAttribute(
      "href",
      "/danas"
    );
  });
});
