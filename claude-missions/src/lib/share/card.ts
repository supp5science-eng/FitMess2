/**
 * Shared, pure helpers for the FitMess share cards (Share-cards PRD).
 *
 * Everything here is framework-free and deterministic so it can be unit-tested
 * the same "money-math" way the rest of `lib/**` is: the numbers and strings a
 * card shows are shaped here, never eyeballed inside the `next/og` template.
 *
 * The card itself is rendered server-side by `next/og` (satori) in
 * `src/app/api/card/scan/route.tsx`; this module owns the format dimensions,
 * the display formatting, and the exact glyph set the font loader must subset.
 */

import type { ShareTier } from "@/lib/share/tier";

/** Which aspect the user is sharing to (PRD §6). */
export type CardFormat = "story" | "post";

export interface CardDimensions {
  width: number;
  height: number;
}

/**
 * The two shippable formats (PRD §6): 9:16 story (primary, IG/TikTok) and 1:1
 * feed post (secondary). 1080 on the short edge is the story-image standard --
 * crisp on any phone, small enough to render and share in well under the PRD's
 * 10-second budget.
 */
export const CARD_FORMATS: Record<CardFormat, CardDimensions> = {
  story: { width: 1080, height: 1920 },
  post: { width: 1080, height: 1080 },
};

/** Narrow an arbitrary string to a known format, defaulting to the primary. */
export function toCardFormat(value: string | null | undefined): CardFormat {
  return value === "post" ? "post" : "story";
}

/** The app's macro accent trio (dark-theme hex, mirroring `--macro-*` in
 * `globals.css`). Concrete hex because satori can't read CSS variables; the
 * card always sits on a dark scrim, so the dark-theme values are the right
 * ones. This trio IS part of the recognizable signature (PRD §2.2). */
export const MACRO_COLORS = {
  protein: "#f9745f",
  carbs: "#45c78d",
  fat: "#f2c14e",
} as const;

/** One macro as the card renders it: a colored dot, a whole-gram value, a label. */
export interface CardMacro {
  label: string;
  /** Whole grams -- the card never shows macro decimals (§8 "manje je premium"). */
  grams: number;
  color: string;
}

/** The three macros in the fixed P → UH → M order (PRD §3.1), ready to map. */
export function cardMacros(
  protein: number,
  carbs: number,
  fat: number
): CardMacro[] {
  const g = (n: number) => Math.max(0, Math.round(n));
  return [
    { label: "PROTEIN", grams: g(protein), color: MACRO_COLORS.protein },
    { label: "UGLJENI H.", grams: g(carbs), color: MACRO_COLORS.carbs },
    { label: "MAST", grams: g(fat), color: MACRO_COLORS.fat },
  ];
}

/** Round to a whole kcal for display (the card never shows decimals). */
export function formatKcal(kcal: number): string {
  return String(Math.max(0, Math.round(kcal)));
}

/** A macro weight as "42 g" -- whole grams, the card's premium-minimal grain. */
export function formatGrams(grams: number): string {
  return `${Math.max(0, Math.round(grams))} g`;
}

/** How long a dish name may be before it stops reading as premium. Two lines at
 * the card's display size land around here; longer names are trimmed with an
 * ellipsis rather than allowed to overflow the scrim. */
export const MAX_DISH_NAME = 42;

/**
 * Tidy a user/AI-supplied dish name for the card: collapse whitespace, trim,
 * and cap the length (adding a single ellipsis) so it never overruns two lines.
 * An empty name falls back to a calm generic rather than a blank hero line.
 */
export function cleanDishName(name: string): string {
  const collapsed = name.replace(/\s+/g, " ").trim();
  if (collapsed.length === 0) return "Obrok";
  if (collapsed.length <= MAX_DISH_NAME) return collapsed;
  // Trim on a word boundary where possible, then append the ellipsis.
  const cut = collapsed.slice(0, MAX_DISH_NAME - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > MAX_DISH_NAME * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${base.trimEnd()}…`;
}

/** Fixed text that appears on every scan card, so the glyph set always covers
 * it even for a name that shares no letters with the chrome. */
export const CARD_CHROME_TEXT =
  "FitMess fitmess.rs kcal PROTEIN UGLJENI H. MAST g ONYX 0123456789";

/**
 * The exact set of characters the card will paint, as one deduplicated string.
 *
 * `next/og` subsets the brand font to precisely these glyphs (see
 * `src/lib/share/fonts.ts`), which is what keeps the font payload tiny AND
 * guarantees Serbian letters (č/ć/š/ž/đ) in a dish name are actually present in
 * the subset -- the whole reason the loader is text-driven.
 */
export function cardGlyphSet(...parts: string[]): string {
  const seen = new Set<string>();
  // A space so the subset can always lay out word gaps.
  seen.add(" ");
  for (const part of parts) {
    for (const ch of part) seen.add(ch);
  }
  return [...seen].join("");
}

/** Everything the scan-card template needs, already formatted and tier-tagged.
 * Assembled on the server (`route.tsx`) from validated input + the user's real
 * streak; the template is then a pure function of this shape. */
export interface ScanCardModel {
  dishName: string;
  kcal: string;
  macros: CardMacro[];
  tier: ShareTier;
  format: CardFormat;
  /** `data:` URI of the user's meal photo -- the full-bleed background. */
  photoDataUri: string;
}
