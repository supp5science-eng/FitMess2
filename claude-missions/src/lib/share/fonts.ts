/**
 * Brand-font loader for the `next/og` share cards.
 *
 * The app's typeface is Inter (`src/app/layout.tsx`, via `next/font`). satori
 * can't reach that self-hosted copy, so the card fetches Inter from Google
 * Fonts at render time using the officially documented `next/og` pattern: ask
 * the CSS API for ONLY the glyphs this card actually paints (`&text=`), which
 * returns a tiny per-request TrueType subset. Text-driven subsetting is also
 * what guarantees Serbian letters in a dish name (č/ć/š/ž/đ) are in the file --
 * a fixed pre-bundled subset would miss whatever the user happened to type.
 *
 * Reliability first: every fetch is time-boxed and wrapped, and ANY failure
 * (Google unreachable, policy block, malformed CSS) resolves to an empty font
 * list. `ImageResponse` then falls back to its built-in sans-serif and the card
 * still renders -- brand-perfect when the network cooperates, never broken when
 * it doesn't.
 */

/** A satori font weight (matches `next/og`'s `FontOptions["weight"]` union). */
export type FontWeight = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;

/** The Inter weights the scan-card template uses. Keep in sync with the
 * `fontWeight` values in `scan-card-template.tsx`. */
export const CARD_FONT_WEIGHTS: readonly FontWeight[] = [600, 700, 800];

export interface LoadedFont {
  name: string;
  data: ArrayBuffer;
  weight: FontWeight;
  style: "normal";
}

/** How long to wait on Google before giving up and rendering with the
 * fallback face. A share should never hang on a font. */
const FONT_FETCH_TIMEOUT_MS = 4000;

/** Process-lifetime cache: identical shares (e.g. flipping the format toggle,
 * which re-renders the same text) reuse the bytes instead of refetching. */
const cache = new Map<string, ArrayBuffer>();

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FONT_FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Resolve the subset TTF URL out of a Google Fonts CSS response. */
function extractFontUrl(css: string): string | null {
  const typed = css.match(
    /src:\s*url\((https:\/\/[^)]+)\)\s*format\('(?:truetype|opentype)'\)/
  );
  if (typed?.[1]) return typed[1];
  const any = css.match(/url\((https:\/\/[^)]+)\)/);
  return any?.[1] ?? null;
}

async function loadOne(
  text: string,
  weight: FontWeight
): Promise<LoadedFont | null> {
  const key = `${weight}:${text}`;
  const cached = cache.get(key);
  if (cached) return { name: "Inter", data: cached, weight, style: "normal" };

  try {
    const cssUrl =
      `https://fonts.googleapis.com/css2?family=Inter:wght@${weight}` +
      `&text=${encodeURIComponent(text)}`;
    const cssRes = await fetchWithTimeout(cssUrl);
    if (!cssRes.ok) return null;

    const fontUrl = extractFontUrl(await cssRes.text());
    if (!fontUrl) return null;

    const fontRes = await fetchWithTimeout(fontUrl);
    if (!fontRes.ok) return null;

    const data = await fontRes.arrayBuffer();
    if (data.byteLength === 0) return null;

    cache.set(key, data);
    return { name: "Inter", data, weight, style: "normal" };
  } catch {
    // Timeout, abort, network, or policy block -- fall back to sans-serif.
    return null;
  }
}

/**
 * Load the Inter subset covering `text` for every weight the card uses.
 *
 * Returns whatever succeeded (possibly `[]`). Fetches run concurrently so the
 * whole set costs one round-trip's worth of latency, not three.
 */
export async function loadCardFonts(text: string): Promise<LoadedFont[]> {
  const results = await Promise.all(
    CARD_FONT_WEIGHTS.map((weight) => loadOne(text, weight))
  );
  return results.filter((font): font is LoadedFont => font !== null);
}
