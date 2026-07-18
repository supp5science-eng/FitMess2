import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ScanScreen } from "@/components/scan/scan-screen";

// F030: `ScanScreen` owns the "what happens after a successful scan" state
// (`BarcodeScanner` itself only emits the decoded GTIN via a callback, per
// its own contract) -- these tests prove a successful decode renders a
// real confirmation screen showing the exact scanned code (never silently
// doing nothing, never navigating away unexpectedly) and offers both a
// manual-search continuation and a "scan again" affordance, and that the
// permission-denied fallback (AS-058) still surfaces correctly through this
// wrapper.

vi.mock("@/lib/scan/barcode-detector", () => ({
  decodeBarcode: vi.fn(),
}));

import { decodeBarcode } from "@/lib/scan/barcode-detector";

const mockDecodeBarcode = vi.mocked(decodeBarcode);

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

describe("F030: ScanScreen composes BarcodeScanner with a real post-scan confirmation", () => {
  beforeEach(() => {
    mockDecodeBarcode.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    deleteMediaDevices();
  });

  it("test_scan_screen_shows_the_permission_denied_fallback_when_no_camera_is_available", async () => {
    deleteMediaDevices();

    render(<ScanScreen />);

    expect(
      await screen.findByTestId("scanner-permission-denied")
    ).toBeInTheDocument();
  });

  it("test_scan_screen_shows_the_exact_decoded_code_after_a_successful_scan_never_a_blank_screen", async () => {
    mockDecodeBarcode.mockResolvedValue({
      value: "5901234123457",
      format: "ean_13",
    });
    defineMediaDevices({
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }],
      }),
    });

    render(<ScanScreen />);

    const detected = await screen.findByTestId("scanner-detected", {}, { timeout: 3000 });
    expect(detected).toBeInTheDocument();
    expect(screen.getByTestId("scanner-detected-code")).toHaveTextContent(
      "5901234123457"
    );

    // A real continuation link, not a dead end.
    const manualSearchLink = screen.getByRole("link", {
      name: "Pretraži hranu",
    });
    expect(manualSearchLink).toHaveAttribute("href", "/dodaj/pretraga");
  });

  it("test_scan_screen_scan_again_button_returns_to_the_live_scanner", async () => {
    mockDecodeBarcode.mockResolvedValue({
      value: "5901234123457",
      format: "ean_13",
    });
    defineMediaDevices({
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }],
      }),
    });

    render(<ScanScreen />);
    await screen.findByTestId("scanner-detected");

    fireEvent.click(screen.getByTestId("scanner-scan-again-button"));

    await waitFor(() => {
      expect(screen.queryByTestId("scanner-detected")).not.toBeInTheDocument();
    });
  });

  it("test_AS_128_the_detected_confirmation_screen_has_no_bare_images_and_labeled_keyboard_reachable_controls", async () => {
    mockDecodeBarcode.mockResolvedValue({
      value: "5901234123457",
      format: "ean_13",
    });
    defineMediaDevices({
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }],
      }),
    });

    render(<ScanScreen />);
    const detected = await screen.findByTestId("scanner-detected");

    expect(detected.querySelectorAll("img")).toHaveLength(0);

    // Real, natively keyboard-reachable controls with visible-text
    // accessible names -- a real `<a>` and a real `<button>`, not
    // `<div onClick>` fakes.
    const continueLink = screen.getByRole("link", { name: "Pretraži hranu" });
    expect(continueLink.tagName).toBe("A");
    expect(continueLink).toHaveAttribute("href", "/dodaj/pretraga");

    const scanAgainButton = screen.getByRole("button", {
      name: "Skeniraj ponovo",
    });
    expect(scanAgainButton.tagName).toBe("BUTTON");
  });
});
