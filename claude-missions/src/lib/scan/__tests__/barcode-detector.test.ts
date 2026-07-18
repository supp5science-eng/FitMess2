// @vitest-environment node
//
// This file deliberately runs in Vitest's "node" environment, NOT the
// project's default "jsdom" one (see `vitest.config.ts`). Reason: the
// `barcode-detector` ponyfill's Blob-decoding path branches on
// `globalThis.Image` being present -- jsdom DOES define a stub `Image`
// constructor whose `.decode()` cannot actually decode real image bytes (no
// real image codec in jsdom), which makes the ponyfill throw
// "Failed to load or decode Blob." Plain Node has no `Image`/
// `createImageBitmap` globals at all, so the ponyfill instead hands the raw
// PNG bytes straight to the ZXing WASM reader's own built-in image decoder
// -- the exact same code path a real browser's `BarcodeDetector.detect()`
// takes internally, just reached via a different branch. This is a test
// ENVIRONMENT concern only; the actual runtime code
// (`src/lib/scan/barcode-detector.ts`) is unchanged by this and runs
// identically in the real browser (verified manually against Chromium/Edge
// -- see the handoff's screenshot evidence). The camera/DOM-facing behavior
// (permission handling, video element, viewfinder) lives in
// `BarcodeScanner` and IS tested under jsdom in
// `src/components/scan/__tests__/barcode-scanner.test.tsx`.

import { readFile } from "node:fs/promises";
import path from "node:path";

import { beforeAll, describe, expect, it, vi } from "vitest";

// Minimal `DOMRectReadOnly` shim: plain Node has no DOM globals at all, and
// the ponyfill's `DetectedBarcode.boundingBox` construction needs this
// constructor to exist. Guarded with `??=` so it's a no-op under any
// environment that already defines the real one.
(globalThis as { DOMRectReadOnly?: unknown }).DOMRectReadOnly ??= class {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  left: number;
  right: number;
  bottom: number;
  constructor(x = 0, y = 0, width = 0, height = 0) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.top = y;
    this.left = x;
    this.right = x + width;
    this.bottom = y + height;
  }
};

import {
  __resetBarcodeDetectorForTests,
  decodeBarcode,
} from "@/lib/scan/barcode-detector";

// F030 / AS-052: proves the barcode decode wiring runs entirely
// client-side, powered by the real `barcode-detector` (ZXing-C++ compiled
// to WebAssembly) package -- no scanned image or frame is ever sent to any
// server, API, or AI model.
//
// The fixture (`fixtures/ean13-5901234123457.png`) is a REAL, valid EAN-13
// barcode image encoding the canonical Wikipedia EAN-13 example number
// (checksum-verified: 12-digit weighted sum 83, check digit (10 - 83%10)%10
// = 7, matching the fixture's trailing "7"), generated with zxing-wasm's own
// writer so the reader side of this exact same library is being proven
// against an authentic barcode, not a synthetic mock image.
//
// The decoder's WASM engine binary is self-hosted (see
// `src/lib/scan/barcode-detector.ts`'s `WASM_PATH`, pointing at
// `/wasm/zxing_reader.wasm` rather than the package's default jsDelivr CDN
// URL). This test intercepts that ONE-TIME same-origin `.wasm` fetch with a
// local-disk read of the exact same binary the app ships in `public/wasm/`
// (so the suite never needs real network access, matching every other test
// in this codebase), then asserts the ACTUAL `detect()` calls that follow
// make ZERO `fetch` calls -- proving decoding itself needs no network
// access at all once the engine is loaded, exactly like any other
// client-side image-processing call.

const WASM_DISK_PATH = path.resolve(
  process.cwd(),
  "public/wasm/zxing_reader.wasm"
);
const FIXTURE_PATH = path.resolve(
  __dirname,
  "fixtures/ean13-5901234123457.png"
);
const EXPECTED_GTIN = "5901234123457";

let realFetch: typeof fetch;

beforeAll(() => {
  realFetch = globalThis.fetch;
});

async function loadFixtureBlob(): Promise<Blob> {
  const bytes = await readFile(FIXTURE_PATH);
  return new Blob([new Uint8Array(bytes)], { type: "image/png" });
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

describe("AS-052: barcode decoding runs entirely client-side, with no network/AI call", () => {
  it("test_AS_052_decodes_a_real_ean_13_barcode_image_to_its_exact_gtin_with_no_ai_or_lookup_call", async () => {
    __resetBarcodeDetectorForTests();

    // Stand in for the app's own self-hosted, same-origin `/wasm/...` asset
    // load -- served here from local disk instead of over a real network
    // socket, but structurally identical: it is the decoder ENGINE binary,
    // never the scanned image, and it is never re-fetched per scan.
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url.endsWith(".wasm")) {
        const bytes = await readFile(WASM_DISK_PATH);
        return new Response(new Uint8Array(bytes), {
          status: 200,
          headers: { "Content-Type": "application/wasm" },
        });
      }
      throw new Error(`Unexpected network fetch in AS-052 test: ${url}`);
    }) as typeof fetch;

    const blob = await loadFixtureBlob();
    const result = await decodeBarcode(blob);

    globalThis.fetch = realFetch;

    expect(result).not.toBeNull();
    expect(result?.value).toBe(EXPECTED_GTIN);
    expect(result?.format).toBe("ean_13");
  });

  it("test_AS_052_a_single_decode_call_makes_zero_fetch_requests_once_the_decoder_engine_is_warm", async () => {
    // Deliberately does NOT call `__resetBarcodeDetectorForTests()` --
    // reuses the module-level detector singleton the previous test already
    // warmed, because the entire point of this test is to prove a decode
    // call, once the engine is loaded, needs no fetch at all (no image
    // upload, no API call, no AI call).
    const fetchSpy = vi.fn(async () => {
      throw new Error("decodeBarcode must not call fetch during decode");
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const blob = await loadFixtureBlob();
    const result = await decodeBarcode(blob);

    globalThis.fetch = realFetch;

    expect(result?.value).toBe(EXPECTED_GTIN);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("test_AS_052_repeated_decode_calls_across_a_simulated_live_scan_loop_never_touch_the_network", async () => {
    // The real `BarcodeScanner` component polls `decodeBarcode` on an
    // interval against successive camera frames -- this proves that
    // sustained, repeated decoding (not just a single call) stays
    // network-free once the engine is warm.
    const fetchSpy = vi.fn(async () => {
      throw new Error("decodeBarcode must not call fetch during decode");
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const blob = await loadFixtureBlob();
    for (let i = 0; i < 3; i += 1) {
      const result = await decodeBarcode(blob);
      expect(result?.value).toBe(EXPECTED_GTIN);
    }

    globalThis.fetch = realFetch;
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
