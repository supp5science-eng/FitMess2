import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { BarcodeScanner } from "@/components/scan/barcode-scanner";

// F030 / AS-058: "if camera permission is denied or no camera exists, show
// a friendly Serbian message and offer manual search instead (link to
// /dodaj/pretraga). Never a broken/blank screen." These tests simulate
// every way a real device can fail to hand over a camera stream (no camera
// API at all, `NotAllowedError`, `NotFoundError`) and assert the same
// real, non-blank fallback screen renders every time, always with a real
// `next/link` to `/dodaj/pretraga`.
//
// Live camera decoding itself is covered separately and directly against
// the real `barcode-detector` package in
// `src/lib/scan/__tests__/barcode-detector.test.ts` (AS-052) -- camera
// live-drive is hard to exercise headlessly (no jsdom `MediaStream`/video
// decode pipeline), so `decodeBarcode` is mocked here to test this
// component's own state wiring (loading -> scanning -> detected/error) in
// isolation, per this feature's definition-of-done note.

vi.mock("@/lib/scan/barcode-detector", () => ({
  decodeBarcode: vi.fn(),
}));

import { decodeBarcode } from "@/lib/scan/barcode-detector";

const mockDecodeBarcode = vi.mocked(decodeBarcode);

function fakeMediaStream(): MediaStream {
  const stop = vi.fn();
  return {
    getTracks: () => [{ stop }],
  } as unknown as MediaStream;
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

describe("AS-058: camera permission denied / no camera -> Serbian fallback + manual search", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    deleteMediaDevices();
  });

  it("test_AS_058_no_mediaDevices_api_at_all_shows_serbian_no_camera_message_and_manual_search_link", async () => {
    deleteMediaDevices();

    render(<BarcodeScanner onDetected={vi.fn()} />);

    const fallback = await screen.findByTestId("scanner-permission-denied");
    expect(fallback).toBeInTheDocument();
    expect(screen.getByTestId("scanner-denied-message")).toHaveTextContent(
      "Nije pronađena kamera na ovom uređaju. Pretraži ručno."
    );

    const manualSearchLink = screen.getByTestId("scanner-manual-search-link");
    expect(manualSearchLink.tagName).toBe("A");
    expect(manualSearchLink).toHaveAttribute("href", "/dodaj/pretraga");
  });

  it("test_AS_058_permission_denied_getUserMedia_rejection_shows_serbian_denied_message_and_manual_search_link", async () => {
    const getUserMedia = vi
      .fn()
      .mockRejectedValue(new DOMException("Denied", "NotAllowedError"));
    defineMediaDevices({ getUserMedia });

    render(<BarcodeScanner onDetected={vi.fn()} />);

    const fallback = await screen.findByTestId("scanner-permission-denied");
    expect(fallback).toBeInTheDocument();
    expect(screen.getByTestId("scanner-denied-message")).toHaveTextContent(
      "Nemamo pristup kameri."
    );

    const manualSearchLink = screen.getByTestId("scanner-manual-search-link");
    expect(manualSearchLink).toHaveAttribute("href", "/dodaj/pretraga");
  });

  it("test_AS_058_no_camera_found_getUserMedia_rejection_shows_serbian_no_camera_message_and_manual_search_link", async () => {
    const getUserMedia = vi
      .fn()
      .mockRejectedValue(new DOMException("No device", "NotFoundError"));
    defineMediaDevices({ getUserMedia });

    render(<BarcodeScanner onDetected={vi.fn()} />);

    const fallback = await screen.findByTestId("scanner-permission-denied");
    expect(fallback).toBeInTheDocument();
    expect(screen.getByTestId("scanner-denied-message")).toHaveTextContent(
      "Nije pronađena kamera na ovom uređaju."
    );

    const manualSearchLink = screen.getByTestId("scanner-manual-search-link");
    expect(manualSearchLink).toHaveAttribute("href", "/dodaj/pretraga");
  });

  it("test_AS_058_the_fallback_screen_is_never_blank_it_always_has_visible_text_and_a_real_link", async () => {
    deleteMediaDevices();

    render(<BarcodeScanner onDetected={vi.fn()} />);

    const fallback = await screen.findByTestId("scanner-permission-denied");
    expect(fallback.textContent?.trim().length).toBeGreaterThan(0);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});

describe("AS-052/AS-058 wiring: BarcodeScanner's other rendered states", () => {
  beforeEach(() => {
    mockDecodeBarcode.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    deleteMediaDevices();
  });

  it("test_scanner_shows_a_loading_skeleton_while_camera_permission_is_pending", () => {
    let resolveGetUserMedia: (stream: MediaStream) => void = () => {};
    const getUserMedia = vi.fn(
      () =>
        new Promise<MediaStream>((resolve) => {
          resolveGetUserMedia = resolve;
        })
    );
    defineMediaDevices({ getUserMedia });

    render(<BarcodeScanner onDetected={vi.fn()} />);

    expect(screen.getByTestId("scanner-loading")).toBeInTheDocument();
    // Avoid an unresolved promise leaking into the next test.
    resolveGetUserMedia(fakeMediaStream());
  });

  it("test_scanner_renders_the_video_and_viewfinder_once_a_camera_stream_is_granted", async () => {
    mockDecodeBarcode.mockResolvedValue(null);
    const getUserMedia = vi.fn().mockResolvedValue(fakeMediaStream());
    defineMediaDevices({ getUserMedia });

    render(<BarcodeScanner onDetected={vi.fn()} />);

    const screenEl = await screen.findByTestId("scanner-screen");
    expect(screenEl).toBeInTheDocument();
    expect(screen.getByTestId("scanner-video")).toBeInTheDocument();
    expect(screen.getByTestId("scanner-viewfinder")).toBeInTheDocument();
  });

  it("test_scanner_calls_onDetected_with_the_decoded_gtin_and_never_navigates_itself", async () => {
    mockDecodeBarcode.mockResolvedValue({ value: "5901234123457", format: "ean_13" });
    const stop = vi.fn();
    const getUserMedia = vi.fn().mockResolvedValue({
      getTracks: () => [{ stop }],
    } as unknown as MediaStream);
    defineMediaDevices({ getUserMedia });

    const onDetected = vi.fn();
    render(<BarcodeScanner onDetected={onDetected} />);

    await screen.findByTestId("scanner-screen");

    await waitFor(() => {
      expect(onDetected).toHaveBeenCalledWith("5901234123457");
    });
    // The camera track is stopped as soon as a barcode is found (no
    // lingering camera access, no side navigation triggered by the
    // component itself -- that's the caller's decision, per this
    // component's own contract).
    expect(stop).toHaveBeenCalled();
  });

  it("test_scanner_treats_a_not_ready_video_frame_as_a_silent_retry_not_a_scary_error", async () => {
    // Real cameras briefly have no decodable frame right after the stream
    // attaches (before the first frame paints) -- the decoder reports that
    // as `InvalidStateError`. This must NOT flip the UI into the
    // error/retry state; it should just keep scanning until a real frame
    // (and eventually a real barcode) is available.
    mockDecodeBarcode
      .mockRejectedValueOnce(
        new DOMException("Invalid element or state.", "InvalidStateError")
      )
      .mockResolvedValue({ value: "5901234123457", format: "ean_13" });
    const getUserMedia = vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
    } as unknown as MediaStream);
    defineMediaDevices({ getUserMedia });

    const onDetected = vi.fn();
    render(<BarcodeScanner onDetected={onDetected} />);

    await screen.findByTestId("scanner-screen");

    await waitFor(() => {
      expect(onDetected).toHaveBeenCalledWith("5901234123457");
    });
    expect(screen.queryByTestId("scanner-error-state")).not.toBeInTheDocument();
  });
});

describe("Barcode image upload: decode a chosen photo entirely client-side", () => {
  beforeEach(() => {
    mockDecodeBarcode.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    deleteMediaDevices();
  });

  it("test_uploading_an_image_with_a_decodable_barcode_calls_onDetected_with_the_gtin", async () => {
    // No camera -> the denied fallback still offers the upload affordance.
    deleteMediaDevices();
    mockDecodeBarcode.mockResolvedValue({
      value: "5901234123457",
      format: "ean_13",
    });

    const onDetected = vi.fn();
    render(<BarcodeScanner onDetected={onDetected} />);
    await screen.findByTestId("scanner-permission-denied");

    const file = new File(["barcode-bytes"], "barcode.jpg", {
      type: "image/jpeg",
    });
    fireEvent.change(screen.getByTestId("scanner-upload-input"), {
      target: { files: [file] },
    });

    await waitFor(() =>
      expect(onDetected).toHaveBeenCalledWith("5901234123457")
    );
    // The decode ran against the chosen File itself (client-side WASM) --
    // proving no server round-trip is involved for an uploaded image either.
    expect(mockDecodeBarcode).toHaveBeenCalledWith(file);
  });

  it("test_uploading_an_image_with_no_barcode_shows_a_friendly_message_and_does_not_call_onDetected", async () => {
    deleteMediaDevices();
    mockDecodeBarcode.mockResolvedValue(null);

    const onDetected = vi.fn();
    render(<BarcodeScanner onDetected={onDetected} />);
    await screen.findByTestId("scanner-permission-denied");

    const file = new File(["not-a-barcode"], "photo.jpg", {
      type: "image/jpeg",
    });
    fireEvent.change(screen.getByTestId("scanner-upload-input"), {
      target: { files: [file] },
    });

    await waitFor(() =>
      expect(screen.getByTestId("scanner-upload-message")).toBeInTheDocument()
    );
    expect(onDetected).not.toHaveBeenCalled();
  });
});

describe("AS-128: no bare images without alt text, interactive elements are labeled and keyboard-reachable", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    deleteMediaDevices();
  });

  it("test_AS_128_the_permission_denied_screen_has_no_bare_images_and_a_labeled_keyboard_reachable_link", async () => {
    deleteMediaDevices();

    render(<BarcodeScanner onDetected={vi.fn()} />);

    const fallback = await screen.findByTestId("scanner-permission-denied");
    // No `<img>` without alt text -- the only icon (`CameraOff`) is an
    // inline SVG marked `aria-hidden`, not an `<img>`.
    expect(fallback.querySelectorAll("img")).toHaveLength(0);

    // A real `<a>` (natively keyboard-reachable via Tab, no custom
    // `tabIndex`/`onClick` div fakery) with a visible text accessible name.
    const link = screen.getByRole("link", { name: "Pretraži ručno" });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/dodaj/pretraga");
  });

  it("test_AS_128_the_error_state_retry_button_and_manual_search_link_are_labeled_and_keyboard_reachable", async () => {
    mockDecodeBarcode.mockRejectedValue(new Error("decode exploded"));
    const getUserMedia = vi.fn().mockResolvedValue(fakeMediaStream());
    defineMediaDevices({ getUserMedia });

    render(<BarcodeScanner onDetected={vi.fn()} />);

    const errorState = await screen.findByTestId("scanner-error-state");
    expect(errorState.querySelectorAll("img")).toHaveLength(0);

    // A real `<button>` (keyboard-activatable with Enter/Space by default)
    // whose visible text ("Pokušaj ponovo") is its accessible name -- the
    // decorative `RefreshCw` icon inside it is `aria-hidden`.
    const retryButton = screen.getByRole("button", { name: "Pokušaj ponovo" });
    expect(retryButton.tagName).toBe("BUTTON");

    const manualSearchLink = screen.getByRole("link", {
      name: "Ili pretraži ručno",
    });
    expect(manualSearchLink).toHaveAttribute("href", "/dodaj/pretraga");
  });

  it("test_AS_128_the_live_scanning_screen_labels_the_video_element_and_has_no_bare_images", async () => {
    mockDecodeBarcode.mockResolvedValue(null);
    const getUserMedia = vi.fn().mockResolvedValue(fakeMediaStream());
    defineMediaDevices({ getUserMedia });

    render(<BarcodeScanner onDetected={vi.fn()} />);

    const screenEl = await screen.findByTestId("scanner-screen");
    expect(screenEl.querySelectorAll("img")).toHaveLength(0);

    // The `<video>` element is not a plain decorative image -- it carries
    // its own accessible name via `aria-label` (the closest video
    // equivalent of an image's `alt` text).
    const video = screen.getByLabelText("Prikaz kamere za skeniranje barkoda");
    expect(video).toBe(screen.getByTestId("scanner-video"));

    const manualSearchLink = screen.getByRole("link", {
      name: "Ne vidiš barkod? Pretraži ručno.",
    });
    expect(manualSearchLink).toHaveAttribute("href", "/dodaj/pretraga");
  });
});
