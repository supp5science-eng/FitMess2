// "Nisam pojeo sve" (2026-08-01): the share of the photographed plate that
// actually got eaten.
//
// Every photo flow estimates what was SERVED, because that is all a photo can
// show. What the day should count is what was EATEN, and those two are the same
// number only when the plate comes back empty. Someone who leaves a third of a
// burek and has no way to say so has exactly two options today: type a smaller
// gram figure (a number they do not know), or log a meal they did not eat. Both
// are worse than a slider.
//
// The share is expressed as a percentage rather than grams on purpose: "I ate
// about half" is a judgement people can actually make by looking at a plate,
// while "I ate 210 g of it" is not. The math then rides the SAME per-100 g
// rescale the gram field already used, so nothing new can disagree with it —
// macros, micronutrients and the itemised breakdown all follow one multiplier.

/** Nobody logs a meal to say they ate none of it — a plate below this is a
 * plate that shouldn't be logged, and "Otkaži" is the honest answer. */
export const MIN_EATEN_SHARE = 5;
/** The whole plate: the default, and the only value that changes nothing. */
export const FULL_EATEN_SHARE = 100;
/** Coarse steps on purpose. The input is an eyeball estimate, so offering 63%
 * would be pretending to a precision the user does not have — and 5% steps keep
 * the thumb reachable with one finger. */
export const EATEN_SHARE_STEP = 5;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/** Keeps a share inside the usable range. Anything unusable (NaN from a
 * hand-edited input, Infinity from a divide) reads as "the whole plate", which
 * is the only safe default: it never silently shrinks what the day counts. */
export function clampEatenShare(share: number): number {
  if (!Number.isFinite(share)) return FULL_EATEN_SHARE;
  return clamp(Math.round(share), MIN_EATEN_SHARE, FULL_EATEN_SHARE);
}

/** Grams eaten, given the served portion and the share of it. Rounded to whole
 * grams because that is the resolution every downstream field uses. */
export function gramsForEatenShare(servedGrams: number, share: number): number {
  const served = Number.isFinite(servedGrams) ? Math.max(servedGrams, 0) : 0;
  return Math.max(Math.round((served * clampEatenShare(share)) / 100), 0);
}

/**
 * The inverse: which share a hand-typed gram figure corresponds to.
 *
 * The two controls are two views of one value, so typing "200 g" of a 400 g
 * plate must move the slider to 50% rather than leave it lying at 100%. A figure
 * ABOVE the served portion is not a share at all -- the estimate itself was
 * low -- so the caller re-bases the served amount and this returns full.
 */
export function eatenShareForGrams(
  servedGrams: number,
  eatenGrams: number
): number {
  if (!Number.isFinite(servedGrams) || servedGrams <= 0) {
    return FULL_EATEN_SHARE;
  }
  if (!Number.isFinite(eatenGrams) || eatenGrams <= 0) return MIN_EATEN_SHARE;
  return clampEatenShare((eatenGrams / servedGrams) * 100);
}

/** Message key for the words beside the percentage. Words, not just a number,
 * because "40%" of a plate is an abstraction and "manje od pola" is not. */
export type EatenShareLabelKey =
  | "dodaj.eaten.all"
  | "dodaj.eaten.almostAll"
  | "dodaj.eaten.mostOfIt"
  | "dodaj.eaten.half"
  | "dodaj.eaten.lessThanHalf"
  | "dodaj.eaten.aThird"
  | "dodaj.eaten.aBit";

export function eatenShareLabelKey(share: number): EatenShareLabelKey {
  const value = clampEatenShare(share);
  if (value >= FULL_EATEN_SHARE) return "dodaj.eaten.all";
  if (value >= 85) return "dodaj.eaten.almostAll";
  if (value >= 60) return "dodaj.eaten.mostOfIt";
  if (value >= 45) return "dodaj.eaten.half";
  if (value >= 40) return "dodaj.eaten.lessThanHalf";
  if (value >= 25) return "dodaj.eaten.aThird";
  return "dodaj.eaten.aBit";
}
