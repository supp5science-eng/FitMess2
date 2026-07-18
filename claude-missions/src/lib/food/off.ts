import type { FoodInsert } from "@/lib/types/db";

// F022: pure, network-free logic for filtering + mapping Open Food Facts
// (OFF) search results onto our `foods` schema. Kept separate from
// scripts/import-off.ts (which does the actual OFF HTTP fetch + Supabase
// write) so the quality filter -- the exact behaviour AS-035 asserts -- is
// independently unit-testable without a network call or a live DB, same
// split as F021's src/lib/food/seed.ts / scripts/seed-foods.ts.
//
// Covers AS-035: the OFF import stores ONLY entries with complete per-100g
// macro data (kcal + protein + carbs + fat, all present and numeric) AND a
// product name; every imported row is stamped source='off', verified=false
// (never true -- only a human/admin verifies a crowd/OFF row, mirroring the
// seed script's source='seed', verified=true stamp, per the clarified
// Round-B decision #12).

/** Minimal shape of one Open Food Facts search-a-licious hit, restricted to
 * the fields this import actually requests (see the `fields=` query param
 * in scripts/import-off.ts). Left loosely typed (`unknown`-leaning) because
 * this is untrusted third-party JSON -- every field is validated before
 * use, never trusted at the type level alone. */
export interface OffHit {
  code?: unknown;
  product_name?: unknown;
  product_name_sr?: unknown;
  brands?: unknown;
  nutriments?: {
    "energy-kcal_100g"?: unknown;
    proteins_100g?: unknown;
    carbohydrates_100g?: unknown;
    fat_100g?: unknown;
  } | null;
}

export type SkipReason =
  | "missing-barcode"
  | "missing-macros"
  | "missing-name";

export interface SkippedOffHit {
  hit: unknown;
  reason: SkipReason;
}

export interface MappedOffFood {
  barcode: string;
  insert: FoodInsert;
}

function isFiniteNonNegative(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

/** OFF's search-a-licious API returns `brands` as a string array; the
 * classic per-barcode product endpoint (`/api/v2/product/{barcode}`)
 * returns a single comma-separated string. Both are handled defensively so
 * this module works against either OFF endpoint shape. */
function brandsToString(brands: unknown): string | null {
  if (Array.isArray(brands)) {
    const parts = brands
      .filter((b): b is string => typeof b === "string" && b.trim() !== "")
      .map((b) => b.trim());
    return parts.length > 0 ? parts.join(", ") : null;
  }
  if (typeof brands === "string" && brands.trim() !== "") {
    return brands
      .split(",")
      .map((b) => b.trim())
      .filter(Boolean)
      .join(", ");
  }
  return null;
}

/** Clarified field mapping: `product_name -> name_sr (or the Serbian/Latin
 * name if available)` -- prefers OFF's `product_name_sr` (Serbian-language
 * localized name) when OFF has one, otherwise falls back to the generic
 * `product_name`. */
function pickName(hit: OffHit): string | null {
  const sr =
    typeof hit.product_name_sr === "string" ? hit.product_name_sr.trim() : "";
  if (sr !== "") return sr;
  const generic =
    typeof hit.product_name === "string" ? hit.product_name.trim() : "";
  return generic !== "" ? generic : null;
}

function pickBarcode(hit: OffHit): string | null {
  return typeof hit.code === "string" && hit.code.trim() !== ""
    ? hit.code.trim()
    : null;
}

/**
 * The AS-035 quality filter: true only when the hit has a non-empty name
 * AND all four per-100g macros (energy-kcal, proteins, carbohydrates, fat)
 * are present as finite, non-negative numbers. This is the single source
 * of truth the unit tests exercise directly (`off.test.ts`'s
 * `test_AS_035_*` cases) -- scripts/import-off.ts never re-implements this
 * logic, it only calls `filterAndMapOffHits`.
 */
export function hasCompleteMacros(hit: OffHit): boolean {
  if (pickName(hit) === null) return false;
  const n = hit.nutriments;
  if (!n || typeof n !== "object") return false;
  return (
    isFiniteNonNegative(n["energy-kcal_100g"]) &&
    isFiniteNonNegative(n.proteins_100g) &&
    isFiniteNonNegative(n.carbohydrates_100g) &&
    isFiniteNonNegative(n.fat_100g)
  );
}

/**
 * Maps one OFF hit onto a `foods` insert row. Returns `null` (never a
 * partial/garbage row) whenever the hit lacks a barcode, a name, or
 * complete macros -- callers must not insert a `null` result. `source`
 * is always `'off'`, `verified` is always `false`.
 */
export function mapOffHitToFoodInsert(hit: OffHit): FoodInsert | null {
  const barcode = pickBarcode(hit);
  if (!barcode) return null;
  if (!hasCompleteMacros(hit)) return null;

  const name = pickName(hit);
  if (!name) return null;

  const n = hit.nutriments as Record<string, number>;

  return {
    name_sr: name,
    brand: brandsToString(hit.brands),
    kcal_100g: n["energy-kcal_100g"],
    protein_100g: n.proteins_100g,
    carbs_100g: n.carbohydrates_100g,
    fat_100g: n.fat_100g,
    common_units: [],
    barcode,
    source: "off",
    verified: false,
  };
}

export interface FilterOffHitsResult {
  toInsert: MappedOffFood[];
  skippedMissingMacros: SkippedOffHit[];
  skippedDuplicate: { barcode: string }[];
}

/**
 * Pure batch pipeline over one page of raw OFF hits: applies the AS-035
 * quality filter to every hit, then dedupes by barcode both against
 * `existingBarcodes` (already present in the live DB -- from a prior seed
 * or import run, the idempotency requirement from Round-B decision #15)
 * and within this same batch (OFF search pagination can repeat a hit
 * across pages). Returns three disjoint buckets so
 * scripts/import-off.ts's summary log (imported vs skipped-for-missing-
 * macros vs skipped-as-duplicate) is a direct, untouched read of this
 * function's output -- the script never recomputes these numbers itself.
 */
export function filterAndMapOffHits(
  hits: unknown[],
  existingBarcodes: ReadonlySet<string>
): FilterOffHitsResult {
  const toInsert: MappedOffFood[] = [];
  const skippedMissingMacros: SkippedOffHit[] = [];
  const skippedDuplicate: { barcode: string }[] = [];
  const seenInBatch = new Set<string>();

  for (const raw of hits) {
    const hit = (raw ?? {}) as OffHit;
    const barcode = pickBarcode(hit);

    if (!barcode) {
      skippedMissingMacros.push({ hit: raw, reason: "missing-barcode" });
      continue;
    }

    if (!hasCompleteMacros(hit)) {
      skippedMissingMacros.push({ hit: raw, reason: "missing-macros" });
      continue;
    }

    if (existingBarcodes.has(barcode) || seenInBatch.has(barcode)) {
      skippedDuplicate.push({ barcode });
      continue;
    }

    const insert = mapOffHitToFoodInsert(hit);
    if (!insert) {
      // Defensive: hasCompleteMacros passed but mapping still failed (e.g.
      // no usable name) -- report it rather than silently dropping it.
      skippedMissingMacros.push({ hit: raw, reason: "missing-name" });
      continue;
    }

    seenInBatch.add(barcode);
    toInsert.push({ barcode, insert });
  }

  return { toInsert, skippedMissingMacros, skippedDuplicate };
}
