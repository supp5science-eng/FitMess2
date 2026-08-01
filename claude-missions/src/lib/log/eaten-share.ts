import type { Log, LogComponentSnapshot } from "@/lib/types/db";

import { readComponents } from "@/lib/log/add-more";

// "Nisam sve pojeo" (2026-08-01): the share of a logged meal that actually got
// eaten.
//
// Every add-flow estimates what was SERVED, because that is all a photograph
// can show -- and the moment you log a meal is BEFORE you have eaten it. What
// the day should count is what went in. Someone who leaves a third of a burek
// has two options today: type a smaller gram figure (a number nobody knows), or
// log a meal they did not eat. Both are worse than a slider.
//
// So the question is asked where it can be answered honestly: on the meal card,
// afterwards, beside "Dodaj još" and "Obriši". Those three are the same family
// -- "there was more of it", "there was less of it", "it never happened".
//
// The share is a percentage rather than grams on purpose: "about half" is a
// judgement people can make by looking at a plate, "210 g" is not. Everything
// then rides ONE multiplier -- grams, macros, micronutrients and the itemised
// breakdown -- so nothing on the row can drift apart from the rest.
//
// The row keeps holding the EATEN numbers, and `logs.eaten_share` (0025) keeps
// the ratio. That is what makes the control reversible: the served plate is
// always `stored / share`, so sliding back to 100% restores the entry exactly.

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

/** The share stored on a row, defaulting to "all of it" for every entry logged
 * before 0025 (and for any row whose column somehow came back null). */
export function storedEatenShare(log: { eaten_share?: number | null }): number {
  const raw = log.eaten_share;
  if (raw === null || raw === undefined) return FULL_EATEN_SHARE;
  const value = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(value) && value > 0
    ? Math.min(value, FULL_EATEN_SHARE)
    : FULL_EATEN_SHARE;
}

/** The nutrition fields a share rescales. Mirrors `LogNutrition` in
 * `add-more.ts` -- same row, opposite direction. */
export interface EatenShareResult {
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  sugar: number | null;
  sodium: number | null;
  satFat: number | null;
  /** The breakdown, rescaled by the same factor. `null` when the row had none. */
  components: LogComponentSnapshot[] | null;
  /** The share that was applied, after clamping -- what gets stored. */
  share: number;
  /** True when this changes nothing (already at that share). */
  isNoop: boolean;
}

/** The subset of a log row this math reads. */
export type EatenShareLogInput = Pick<
  Log,
  "grams" | "kcal" | "protein" | "carbs" | "fat"
> &
  Partial<
    Pick<
      Log,
      "fiber" | "sugar" | "sodium" | "sat_fat" | "components" | "eaten_share"
    >
  >;

const round1 = (n: number) => Math.round(n * 10) / 10;
const nonNegative = (n: number) =>
  Number.isFinite(n) && n > 0 ? n : 0;

/**
 * Rescales a logged entry to a new eaten share.
 *
 * The entry's stored numbers already correspond to its CURRENT share, so the
 * factor is simply `next / current` -- no need to keep the served plate around
 * anywhere. That is what makes the slider reversible: 100 → 30 → 100 multiplies
 * by 0.3 and then by 1/0.3, landing back on the original (bar a rounded kcal).
 *
 * `kom_grami` on a breakdown line is deliberately NOT scaled: one egg weighs
 * 60 g whether you ate the whole plate or half of it, and "Dodaj još → +1 jaje"
 * on the same entry must keep adding one egg.
 *
 * Micronutrients ride the same factor, and unknown stays unknown (0017): a meal
 * whose fiber we never knew does not become 0 g of fiber because it was
 * half-eaten.
 */
export function applyEatenShare(
  log: EatenShareLogInput,
  nextShare: number
): EatenShareResult {
  const current = storedEatenShare(log);
  const share = clampEatenShare(nextShare);
  const factor = share / current;

  const scaleMicro = (value: number | null | undefined) =>
    typeof value === "number" && Number.isFinite(value)
      ? round1(value * factor)
      : null;

  const components = readComponents(log.components);

  return {
    // Guarded against 0 by the `grams > 0` check on the column: a share can
    // never take an entry all the way down (5% is the floor, and a meal nobody
    // touched is a delete).
    grams: Math.max(round1(nonNegative(log.grams) * factor), 0.1),
    kcal: Math.round(nonNegative(log.kcal) * factor),
    protein: round1(nonNegative(log.protein) * factor),
    carbs: round1(nonNegative(log.carbs) * factor),
    fat: round1(nonNegative(log.fat) * factor),
    fiber: scaleMicro(log.fiber),
    sugar: scaleMicro(log.sugar),
    sodium: scaleMicro(log.sodium),
    satFat: scaleMicro(log.sat_fat),
    components:
      components.length > 0
        ? components.map((component) => ({
            naziv: component.naziv,
            grami: round1(nonNegative(component.grami) * factor),
            kcal: Math.round(nonNegative(component.kcal) * factor),
            protein_g: round1(nonNegative(component.protein_g) * factor),
            uh_g: round1(nonNegative(component.uh_g) * factor),
            mast_g: round1(nonNegative(component.mast_g) * factor),
            // A property of the FOOD, not of how much of it you ate.
            kom_naziv: component.kom_naziv ?? "",
            kom_grami: nonNegative(component.kom_grami ?? 0),
          }))
        : null,
    share,
    isNoop: share === current,
  };
}

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
