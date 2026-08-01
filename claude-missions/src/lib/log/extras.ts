import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { foodEmoji } from "@/lib/food/emoji";
import type { Database, Food, LogComponentSnapshot } from "@/lib/types/db";

// "Nije bilo na slici" (2026-08-01) — the other half of "Dodaj još".
//
// The existing sheet can only grow what the estimator SAW. But the calories
// that actually go missing are the ones that were never in frame: you
// photograph the plate, then reach for the mayonnaise. Mayonnaise is 687
// kcal/100 g and nobody photographs a spoon of it, so a meal logged honestly
// can still land 200 kcal light — the same coverage argument behind Gric and
// behind "Dodaj još" itself.
//
// The whole feature is catalog-backed, so it costs nothing and waits for
// nothing: every extra below already exists in the 350-food seed catalog, is
// `verified`, and already carries a natural unit in `common_units` (kašika
// 15 g, parče 30 g). One tap = one spoon, resolved from real numbers, with no
// Gemini call and no spinner.
//
// The client fetches these to draw chips and to run the live preview, but the
// preview is not what gets written: the request carries only `{foodId, units}`
// and `POST /api/logs/[id]/dodaj` re-reads the same rows server-side. Same
// money-math posture as portions and as `applyAddMore`.

/** Cap on extras offered as one-tap chips — a row you can scan, not a menu. */
export const EXTRAS_LIMIT = 10;

/**
 * The extras worth a chip, in the order they are offered.
 *
 * Ordered by how much damage each one does when forgotten -- kcal per realistic
 * serving TIMES how often it goes unphotographed, not alphabetically and not by
 * kcal alone. Mayonnaise, bread and oil lead because they are both heavy and
 * routinely eaten after the photo.
 *
 * Mustard was deliberately cut: a teaspoon is 4 kcal, so a chip for it would
 * spend a row of the sheet teaching people to log noise. Anything not here is
 * one tap away through "Pretraži".
 *
 * These are `name_sr` values from `supabase/seed/foods.json`. A name that no
 * longer resolves is simply skipped (see `resolveExtraFoods`) — a renamed
 * catalog row must never break the sheet.
 */
export const CURATED_EXTRAS: readonly {
  /** Exact `foods.name_sr` to resolve against. */
  name: string;
  /** Genitive, for "+2 kašike majoneza". */
  of: string;
  /** What the chip says. Catalog names carry qualifiers a chip has no room
   * for ("Pavlaka, kisela 18%") and that the user does not need in order to
   * recognise what they just ate. */
  chip: string;
}[] = [
  { name: "Majonez", of: "majoneza", chip: "Majonez" }, // 103 kcal / kašika
  { name: "Beli hleb", of: "hleba", chip: "Hleb" }, //      73 kcal / parče
  { name: "Suncokretovo ulje", of: "ulja", chip: "Ulje" }, // 126 kcal / kašika
  { name: "Kajmak, domaći", of: "kajmaka", chip: "Kajmak" }, // 91
  { name: "Puter", of: "putera", chip: "Puter" }, //         74
  { name: "Pavlaka, kisela 18%", of: "pavlake", chip: "Pavlaka" }, // 28
  { name: "Kečap", of: "kečapa", chip: "Kečap" }, //         17
  { name: "Ajvar", of: "ajvara", chip: "Ajvar" }, //         25
  { name: "Šećer, beli", of: "šećera", chip: "Šećer" }, //   48, the coffee spoon
];

export const EXTRA_FOOD_NAMES: readonly string[] = CURATED_EXTRAS.map(
  (extra) => extra.name
);

/**
 * Genitive of a curated extra ("majoneza"), so the confirmation chip reads
 * "+2 kašike majoneza" the way a person says it rather than "+2 kašike ·
 * Majonez".
 *
 * Hand-written per food instead of derived: Serbian case endings are not
 * guessable from a nominative by rule, and there are ten of them. A food that
 * arrived through search has no entry here and falls back to the neutral form,
 * which is correct-but-plain rather than confidently wrong.
 */
export function extraGenitive(name: string): string | null {
  return curatedEntry(name)?.of ?? null;
}

/** Fallback serving when a catalog row has no `common_units` — a spoon is the
 * honest default for the things on this list, and 15 g is the Serbian
 * table-spoon the seed data uses throughout. */
const FALLBACK_UNIT_LABEL = "kašika";
const FALLBACK_UNIT_GRAMS = 15;

/**
 * A catalog food resolved down to exactly what one tap adds.
 *
 * Per-100 g fields keep the `foods` column names so there is no silent
 * remapping between the row and the math that consumes it.
 */
export interface ExtraFood {
  id: string;
  name_sr: string;
  kcal_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
  fiber_100g: number | null;
  sugar_100g: number | null;
  sodium_100g: number | null;
  sat_fat_100g: number | null;
  /** The natural single serving: "kašika" / 15. */
  unit_label: string;
  unit_grams: number;
  /** Presentation only — never read by the math. */
  emoji: string;
  /** Short chip label ("Hleb"); the full catalog name is what gets written. */
  label: string;
  /** Genitive for the confirmation chip, `null` when unknown. */
  of: string | null;
}

const num = (value: number | string | null | undefined): number =>
  typeof value === "number"
    ? Number.isFinite(value)
      ? value
      : 0
    : Number(value) || 0;

/** `numeric` columns arrive as strings over PostgREST; unknown stays unknown
 * (0017: a missing micronutrient is NOT zero). */
const micro = (value: number | string | null | undefined): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Picks the serving one tap adds. Prefers the catalog's own first
 * `common_units` entry (curated per food: bread is a 30 g slice, mustard a 5 g
 * teaspoon), falling back to a spoon so a chip always has a meaning.
 */
export function extraUnitOf(food: Pick<Food, "common_units">): {
  label: string;
  grams: number;
} {
  const units = Array.isArray(food.common_units) ? food.common_units : [];
  for (const unit of units) {
    const label = (unit?.label ?? "").trim();
    const grams = num(unit?.grams);
    if (label && grams > 0) return { label, grams };
  }
  return { label: FALLBACK_UNIT_LABEL, grams: FALLBACK_UNIT_GRAMS };
}

/** Narrows a catalog row to the chip-and-math shape. Pure, so the API route
 * and the tests agree on what a resolved extra is. */
export function toExtraFood(food: Food): ExtraFood {
  const unit = extraUnitOf(food);
  return {
    id: food.id,
    name_sr: food.name_sr,
    kcal_100g: num(food.kcal_100g),
    protein_100g: num(food.protein_100g),
    carbs_100g: num(food.carbs_100g),
    fat_100g: num(food.fat_100g),
    fiber_100g: micro(food.fiber_100g),
    sugar_100g: micro(food.sugar_100g),
    sodium_100g: micro(food.sodium_100g),
    sat_fat_100g: micro(food.sat_fat_100g),
    unit_label: unit.label,
    unit_grams: unit.grams,
    emoji: foodEmoji(food.name_sr),
    label: curatedEntry(food.name_sr)?.chip ?? food.name_sr,
    of: curatedEntry(food.name_sr)?.of ?? null,
  };
}

const curatedEntry = (name: string) => {
  const key = name.trim().toLowerCase();
  return CURATED_EXTRAS.find((extra) => extra.name.toLowerCase() === key);
};

/**
 * Orders resolved rows to match `EXTRA_FOOD_NAMES` and drops anything that
 * didn't resolve.
 *
 * The catalog can hold duplicates of the same name (the seed has two
 * sunflower-oil rows) — first one wins, so the chip is stable across reloads
 * instead of flipping between two identical foods.
 */
export function orderExtras(
  foods: Food[],
  names: readonly string[] = EXTRA_FOOD_NAMES
): ExtraFood[] {
  const byName = new Map<string, Food>();
  for (const food of foods) {
    const key = food.name_sr.trim().toLowerCase();
    if (!byName.has(key)) byName.set(key, food);
  }

  const ordered: ExtraFood[] = [];
  for (const name of names) {
    const match = byName.get(name.trim().toLowerCase());
    if (match) ordered.push(toExtraFood(match));
    if (ordered.length >= EXTRAS_LIMIT) break;
  }
  return ordered;
}

/**
 * Reads the curated extras from the catalog through the caller's RLS client
 * (`foods_select_all_authenticated`).
 *
 * Best-effort by design: the chips are an accelerator on top of a sheet that
 * already works, so a failed read returns an empty row rather than an error
 * state. The user still has the steppers and the search field.
 */
export async function getExtraFoods(
  supabase: SupabaseClient<Database>,
  names: readonly string[] = EXTRA_FOOD_NAMES
): Promise<ExtraFood[]> {
  const { data, error } = await supabase
    .from("foods")
    .select("*")
    .in("name_sr", [...names]);

  if (error || !data) return [];
  return orderExtras(data as Food[], names);
}

/**
 * Looks up specific extras by id — what the save path uses. Unlike the chip
 * read this one must be exact, so it returns whatever resolved and lets the
 * caller decide (an id that vanished between opening the sheet and saving is
 * simply not added).
 */
export async function getExtraFoodsByIds(
  supabase: SupabaseClient<Database>,
  ids: readonly string[]
): Promise<ExtraFood[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("foods")
    .select("*")
    .in("id", [...ids]);

  if (error || !data) return [];
  return (data as Food[]).map(toExtraFood);
}

/* --- written-in extras (2026-08-01) --------------------------------------- */

/**
 * Marks an extra that came from `POST /api/dodaci/opis` (the user wrote what
 * they ate) rather than from the catalog.
 *
 * The prefix is load-bearing on the save path: catalog picks are re-read from
 * `foods` server-side precisely so a client cannot author a macro, and an
 * AI-estimated extra has no row to re-read. The prefix keeps those two
 * populations apart, so the catalog rule stays intact for everything it can
 * still apply to.
 */
export const AI_EXTRA_ID_PREFIX = "ai:";

export const isAiExtraId = (id: string): boolean =>
  id.startsWith(AI_EXTRA_ID_PREFIX);

const boundedNumber = (max: number) =>
  z.coerce
    .number()
    .catch(0)
    .transform((n) => (Number.isFinite(n) ? Math.min(Math.max(n, 0), max) : 0));

const boundedNullableNumber = (max: number) =>
  z
    .union([z.coerce.number(), z.null()])
    .nullish()
    .catch(null)
    .transform((n) =>
      typeof n === "number" && Number.isFinite(n)
        ? Math.min(Math.max(n, 0), max)
        : null
    );

/**
 * An AI-estimated extra as it comes back over the wire on save.
 *
 * These numbers ARE client-authored, which is the one exception to the rule the
 * rest of this file exists to enforce -- and it is the same exception
 * `logMealAction` already makes for every photo/voice estimate: the figure was
 * produced by our own server call, shown to the user, and there is no row
 * anywhere to re-derive it from. What this schema guarantees instead is that
 * nothing physically impossible can be written: every field is clamped to the
 * range a real food can occupy, so the worst a tampered request can do is log a
 * plausible food the user chose to log.
 */
export const aiExtraFoodSchema = z
  .object({
    id: z.string().min(1).max(80).startsWith(AI_EXTRA_ID_PREFIX),
    name_sr: z.string().trim().min(1).max(60),
    kcal_100g: boundedNumber(900),
    protein_100g: boundedNumber(100),
    carbs_100g: boundedNumber(100),
    fat_100g: boundedNumber(100),
    fiber_100g: boundedNullableNumber(80),
    sugar_100g: boundedNullableNumber(100),
    sodium_100g: boundedNullableNumber(40000),
    sat_fat_100g: boundedNullableNumber(100),
    unit_label: z.string().trim().min(1).max(24),
    // A single "unit" heavier than 2 kg is not a serving of anything.
    unit_grams: z.coerce.number().min(1).max(2000),
  })
  .transform(
    (extra): ExtraFood => ({
      ...extra,
      // Presentation only, and re-derived here so the wire format stays as
      // small as it can be.
      emoji: foodEmoji(extra.name_sr),
      label: extra.name_sr,
      of: null,
    })
  );

/**
 * What `units` taps of an extra contribute, as a breakdown line.
 *
 * A line is always a whole number of natural units, so it can be stepped again
 * later: `kom_grami` rides along untouched, exactly as `applyAddMore` requires
 * (one egg stays 60 g however much of it is on the plate).
 */
export function extraComponent(
  extra: ExtraFood,
  units: number
): LogComponentSnapshot {
  const grams = extra.unit_grams * units;
  const factor = grams / 100;
  return {
    naziv: extra.name_sr,
    grami: round1(grams),
    kcal: Math.round(extra.kcal_100g * factor),
    protein_g: round1(extra.protein_100g * factor),
    uh_g: round1(extra.carbs_100g * factor),
    mast_g: round1(extra.fat_100g * factor),
    kom_naziv: extra.unit_label,
    kom_grami: extra.unit_grams,
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;
