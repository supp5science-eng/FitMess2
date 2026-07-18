import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// F031: `ScanScreen` (rendered by this route) now calls `useRouter()` for
// its barcode-lookup-MISS redirect -- outside a real Next.js app-router
// tree (as in this Vitest render), that hook throws unless mocked, exactly
// like `src/components/scan/__tests__/scan-screen.test.tsx` already mocks
// it. This route never actually reaches the MISS branch in this test (no
// camera in jsdom -> the AS-058 fallback renders first), but the hook is
// still called during render, so the mock is required either way.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import SkenerPage from "@/app/(app)/dodaj/skener/page";

// F030: `/dodaj/skener` is a thin wrapper around `ScanScreen` -- this test
// just proves the route renders a real, non-blank screen (never a 404 or
// an empty page) rather than re-testing `ScanScreen`'s/`BarcodeScanner`'s
// own state machine, which is already covered directly in
// `src/components/scan/__tests__/`.

function deleteMediaDevices() {
  Object.defineProperty(navigator, "mediaDevices", {
    value: undefined,
    configurable: true,
    writable: true,
  });
}

describe("F030: /dodaj/skener renders a real scanner screen, never blank", () => {
  afterEach(() => {
    deleteMediaDevices();
  });

  it("test_skener_page_renders_the_scan_screen_and_never_a_blank_page", async () => {
    deleteMediaDevices();

    render(<SkenerPage />);

    // No camera API in jsdom -> lands on the AS-058 fallback, but the point
    // here is simply that SOME real, visible content renders for this
    // route.
    const fallback = await screen.findByTestId("scanner-permission-denied");
    expect(fallback).toBeInTheDocument();
    expect(fallback.textContent?.trim().length).toBeGreaterThan(0);
  });
});
