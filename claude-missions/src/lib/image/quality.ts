// Client-side photo sanity check, run before we spend an API call on a shot
// that was never going to work. A blurred or badly under-exposed photo doesn't
// fail loudly -- the model still returns a confident-looking number, just a
// worse one -- so catching it here is the difference between "slika je mutna,
// slikaj ponovo" and a silently wrong meal in the user's day.
//
// Both measures run on a 128px greyscale downscale, so this is a few
// milliseconds on a phone. Deliberately conservative: it WARNS, it never
// blocks. A false alarm that stops someone logging their lunch costs more than
// a slightly soft photo.

export type PhotoIssue = "mutna" | "tamna";

/** Variance of the Laplacian below this reads as out-of-focus. Tuned low on
 * purpose: real food photos of smooth foods (soup, pire) are legitimately
 * low-detail, and calling those "blurry" would be wrong. */
const BLUR_VARIANCE_THRESHOLD = 45;

/** Mean luminance (0–255) below this is too dark to read texture from. */
const DARK_LUMA_THRESHOLD = 42;

/** Working resolution for the analysis. Small enough to be instant, large
 * enough that the Laplacian still sees real edges. */
const SAMPLE_SIZE = 128;

/**
 * Inspect a captured photo. Resolves to the issues found (empty array = fine).
 * Never rejects: if anything about canvas/decoding fails we return no issues,
 * because a broken check must not stand between the user and logging a meal.
 */
export async function inspectPhoto(file: Blob): Promise<PhotoIssue[]> {
  try {
    const gray = await toGreyscale(file);
    if (!gray) return [];

    const issues: PhotoIssue[] = [];
    if (meanLuma(gray.data) < DARK_LUMA_THRESHOLD) issues.push("tamna");
    if (laplacianVariance(gray) < BLUR_VARIANCE_THRESHOLD) issues.push("mutna");
    return issues;
  } catch {
    return [];
  }
}

interface GreyImage {
  data: Float32Array;
  width: number;
  height: number;
}

async function toGreyscale(file: Blob): Promise<GreyImage | null> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(
    SAMPLE_SIZE / bitmap.width,
    SAMPLE_SIZE / bitmap.height,
    1
  );
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    bitmap.close();
    return null;
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const { data: rgba } = ctx.getImageData(0, 0, width, height);
  const data = new Float32Array(width * height);
  for (let i = 0, p = 0; i < rgba.length; i += 4, p++) {
    // Rec. 601 luma -- matches how the eye weights the channels.
    data[p] = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
  }
  return { data, width, height };
}

function meanLuma(data: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i];
  return data.length === 0 ? 0 : sum / data.length;
}

/**
 * Variance of the 4-neighbour Laplacian — the standard focus measure. A sharp
 * image has strong second derivatives at edges (high variance); a blurred one
 * has them smeared away (low variance).
 */
function laplacianVariance({ data, width, height }: GreyImage): number {
  if (width < 3 || height < 3) return Number.POSITIVE_INFINITY;

  const values: number[] = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      values.push(
        data[i - 1] +
          data[i + 1] +
          data[i - width] +
          data[i + width] -
          4 * data[i]
      );
    }
  }
  if (values.length === 0) return Number.POSITIVE_INFINITY;

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return (
    values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length
  );
}
