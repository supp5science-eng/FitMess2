import type { BarcodeDetector as BarcodeDetectorType } from "barcode-detector/ponyfill";

/**
 * F030 / AS-052: reusable, 100% client-side EAN-13 (+ EAN-8) barcode decoder
 * wiring around the `barcode-detector` package (ZXing-C++ compiled to
 * WebAssembly, per `tech-decisions.md`). No image or video frame is ever
 * sent to any server, API, or AI model -- decoding runs entirely inside the
 * browser's own WASM sandbox, so scanning has zero per-scan API cost.
 *
 * The ONLY network-shaped activity involved at all is a ONE-TIME same-origin
 * fetch of the ~1MB `.wasm` decoder binary itself, self-hosted from
 * `/public/wasm/zxing_reader.wasm` (via the `prepareZXingModule` override
 * below) instead of the package's default jsDelivr CDN URL. That fetch
 * happens once per browser session (the browser then caches the binary via
 * normal HTTP caching, same as any other static asset) and never again for
 * each individual `detect()` call -- proven in
 * `src/lib/scan/__tests__/barcode-detector.test.ts` (AS-052) by asserting
 * zero `fetch` calls happen during a `detect()` invocation once the module
 * is warm.
 *
 * `import()` is used (not a static import) so the decoder engine's WASM
 * payload only downloads when a caller actually needs to decode (i.e. when
 * the scan screen mounts), keeping it out of every other route's bundle --
 * this module itself must only ever be imported from client components.
 */

const WASM_PATH = "/wasm/zxing_reader.wasm";

// FitMess only ever needs to read product barcodes -- EAN-13 (the
// overwhelming majority of retail products, including everything already in
// the `foods` table) and EAN-8 (short-format packaging). Restricting formats
// keeps the decoder faster per frame and avoids false positives from
// unrelated barcode types (QR codes, etc.) a camera might see in-frame.
const SUPPORTED_FORMATS = ["ean_13", "ean_8"] as const;

let modulePreparedOnce = false;
let detectorPromise: Promise<BarcodeDetectorType> | null = null;

async function loadPreparedPonyfill() {
  const mod = await import("barcode-detector/ponyfill");
  if (!modulePreparedOnce) {
    mod.prepareZXingModule({
      overrides: {
        locateFile: (path: string, prefix: string) =>
          path.endsWith(".wasm") ? WASM_PATH : prefix + path,
      },
    });
    modulePreparedOnce = true;
  }
  return mod;
}

/**
 * Lazily creates (and caches for the lifetime of the page) a single
 * `BarcodeDetector` instance scoped to EAN-13 + EAN-8.
 */
export async function getBarcodeDetector(): Promise<BarcodeDetectorType> {
  if (!detectorPromise) {
    detectorPromise = loadPreparedPonyfill().then(
      ({ BarcodeDetector }) =>
        new BarcodeDetector({ formats: [...SUPPORTED_FORMATS] })
    );
  }
  return detectorPromise;
}

/** Test-only escape hatch: forces a fresh detector/module on the next call. */
export function __resetBarcodeDetectorForTests(): void {
  modulePreparedOnce = false;
  detectorPromise = null;
}

export interface DecodedBarcode {
  value: string;
  format: string;
}

type DecodeInput = Parameters<BarcodeDetectorType["detect"]>[0];

/**
 * Runs a single client-side decode pass against one image/frame source and
 * returns the FIRST detected EAN-13/EAN-8 barcode's raw value, or `null` if
 * none was found in this frame. Never throws for "nothing found in this
 * frame" -- that is the normal steady state while a live camera loop is
 * still searching. Only a genuine decoder failure propagates, letting the
 * caller decide how to surface that (never a blank/broken screen).
 */
export async function decodeBarcode(
  image: DecodeInput
): Promise<DecodedBarcode | null> {
  const detector = await getBarcodeDetector();
  const results = await detector.detect(image);
  if (results.length === 0) {
    return null;
  }
  const [first] = results;
  return { value: first.rawValue, format: first.format };
}
