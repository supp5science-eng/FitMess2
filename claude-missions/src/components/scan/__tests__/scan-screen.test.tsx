import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ScanScreen } from "@/components/scan/scan-screen";

// F031 / AS-053 (a found barcode shows the food + portion picker), AS-054
// (confirming a portion after a scan creates a log with method='barcode') --
// component-level coverage of `ScanScreen`'s scan -> lookup -> portion
// flow. `BarcodeScanner` itself (F030) is exercised for real here (only its
// own `decodeBarcode` call is mocked, same as F030's own tests) so these
// tests prove the REAL camera/decode loop hands off to a REAL lookup fetch
// + the REAL (unmodified) F025 `PortionPicker` -- not a reimplementation.
// The live-DB half of AS-053/AS-054 (does the lookup/log actually persist
// correctly) is covered separately by
// `src/app/api/foods/barcode/[gtin]/__tests__/route.integration.test.ts`.
//
// Also re-verifies AS-058 (permission-denied fallback) still surfaces
// through this wrapper unchanged, since `ScanScreen` composes
// `BarcodeScanner` directly.

vi.mock("@/lib/scan/barcode-detector", () => ({
  decodeBarcode: vi.fn(),
}));

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { decodeBarcode } from "@/lib/scan/barcode-detector";
import type { Food } from "@/lib/types/db";

const mockDecodeBarcode = vi.mocked(decodeBarcode);

function makeFood(overrides: Partial<Food> = {}): Food {
  return {
    id: "food-1",
    name_sr: "Jabuka sok",
    brand: "Test brend",
    kcal_100g: 250,
    protein_100g: 12,
    carbs_100g: 30,
    fat_100g: 8,
    common_units: [],
    source: "user",
    verified: false,
    barcode: "5901234123457",
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

function defineMediaDevices(value: unknown) {
  Object.defineProperty(navigator, "mediaDevices", {
    value,
    configurable: true,
    writable: true,
  });
}

function deleteMediaDevices() {
  Object.defineProperty(navigator, "mediaDevices", {
    value: undefined,
    configurable: true,
    writable: true,
  });
}

function stubSuccessfulCamera() {
  defineMediaDevices({
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
    }),
  });
}

beforeEach(() => {
  mockDecodeBarcode.mockReset();
  pushMock.mockClear();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
  deleteMediaDevices();
});

describe("F030 (re-verified via ScanScreen): AS-058 permission-denied fallback", () => {
  it("test_scan_screen_shows_the_permission_denied_fallback_when_no_camera_is_available", async () => {
    deleteMediaDevices();

    render(<ScanScreen />);

    expect(
      await screen.findByTestId("scanner-permission-denied")
    ).toBeInTheDocument();
  });
});

describe("F031 / AS-053: a scan that matches a food opens the portion picker", () => {
  it("test_AS_053_a_successful_scan_of_a_known_barcode_opens_the_portion_picker_prefilled_with_that_food", async () => {
    mockDecodeBarcode.mockResolvedValue({
      value: "5901234123457",
      format: "ean_13",
    });
    stubSuccessfulCamera();
    const food = makeFood();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ ok: true, data: food })
    );

    render(<ScanScreen />);

    const portionPicker = await screen.findByTestId(
      "portion-picker",
      {},
      { timeout: 3000 }
    );
    expect(portionPicker).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: food.name_sr })
    ).toBeInTheDocument();

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/foods/barcode/5901234123457"
    );
  });

  it("test_AS_054_confirming_the_portion_after_a_scan_posts_method_barcode_to_api_logs", async () => {
    mockDecodeBarcode.mockResolvedValue({
      value: "5901234123457",
      format: "ean_13",
    });
    stubSuccessfulCamera();
    const food = makeFood();
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.startsWith("/api/foods/barcode/")) {
        return Promise.resolve(jsonResponse({ ok: true, data: food }));
      }
      return Promise.resolve(
        jsonResponse({ ok: true, data: { id: "log-1" } })
      );
    });

    render(<ScanScreen />);
    await screen.findByTestId("portion-picker", {}, { timeout: 3000 });

    fireEvent.click(screen.getByTestId("portion-confirm-button"));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/logs",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            foodId: food.id,
            grams: 100,
            method: "barcode",
          }),
        })
      )
    );
  });
});

describe("F031: a scan with no matching food routes to the first-time-entry flow with the GTIN", () => {
  it("test_a_scan_with_no_matching_food_navigates_to_novi_proizvod_with_the_scanned_gtin", async () => {
    mockDecodeBarcode.mockResolvedValue({
      value: "5901234123457",
      format: "ean_13",
    });
    stubSuccessfulCamera();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ ok: true, data: null })
    );

    render(<ScanScreen />);

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(
        "/dodaj/novi-proizvod?barkod=5901234123457"
      )
    );
  });
});

describe("F031: a genuine lookup failure shows a Serbian error with retry, never a blank screen", () => {
  it("test_a_failed_lookup_request_shows_a_serbian_error_and_a_retry_button", async () => {
    mockDecodeBarcode.mockResolvedValue({
      value: "5901234123457",
      format: "ean_13",
    });
    stubSuccessfulCamera();
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("network down")
    );

    render(<ScanScreen />);

    const errorScreen = await screen.findByTestId(
      "scanner-lookup-error",
      {},
      { timeout: 3000 }
    );
    expect(errorScreen).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Nismo uspeli da proverimo barkod. Pokušaj ponovo."
    );
  });

  it("test_AS_128_the_lookup_error_screen_has_no_bare_images_and_labeled_keyboard_reachable_controls", async () => {
    mockDecodeBarcode.mockResolvedValue({
      value: "5901234123457",
      format: "ean_13",
    });
    stubSuccessfulCamera();
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("network down")
    );

    render(<ScanScreen />);
    const errorScreen = await screen.findByTestId("scanner-lookup-error");

    expect(errorScreen.querySelectorAll("img")).toHaveLength(0);

    const retryButton = screen.getByRole("button", { name: "Pokušaj ponovo" });
    expect(retryButton.tagName).toBe("BUTTON");

    const manualSearchLink = screen.getByRole("link", {
      name: "Pretraži hranu",
    });
    expect(manualSearchLink.tagName).toBe("A");
    expect(manualSearchLink).toHaveAttribute("href", "/dodaj/pretraga");
  });

  it("test_the_retry_button_returns_to_a_live_scan", async () => {
    mockDecodeBarcode.mockResolvedValue({
      value: "5901234123457",
      format: "ean_13",
    });
    stubSuccessfulCamera();
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("network down")
    );

    render(<ScanScreen />);
    await screen.findByTestId("scanner-lookup-error");

    fireEvent.click(screen.getByTestId("scanner-lookup-retry-button"));

    await waitFor(() => {
      expect(
        screen.queryByTestId("scanner-lookup-error")
      ).not.toBeInTheDocument();
    });
  });
});
