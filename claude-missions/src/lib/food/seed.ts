import type { FoodCommonUnit, FoodInsert } from "@/lib/types/db";

// F021: pure, DB-free logic for the curated seed dataset
// (supabase/seed/foods.json) and its idempotent upsert plan.
//
// Kept separate from scripts/seed-foods.ts (which does the actual network
// I/O against Supabase) so it can be unit-tested directly under
// src/lib/food/__tests__ -- vitest.config.ts only picks up
// "src/**/*.test.{ts,tsx}", and scripts/ deliberately holds only the thin,
// un-unit-tested runner (per the clarified "Pattern: Standalone Node/tsx
// script under scripts/" answer).
//
// Covers AS-033 (>=300 foods incl. staples + branded) and AS-034 (sarma,
// gibanica, pasulj, karađorđeva findable) together with the definition-of-
// done items: malformed rows are skipped/logged (never inserted), and
// re-running the plan against its own prior output never duplicates rows.

/** One row of the curated seed dataset, already normalized (post-validation). */
export interface SeedFoodRow {
  name_sr: string;
  brand: string | null;
  kcal_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
  common_units: FoodCommonUnit[];
  /** Present only when the seed item has a known barcode (most don't). */
  barcode?: string;
}

export interface SkippedSeedRow {
  row: unknown;
  reason: string;
}

export interface SeedValidationResult {
  valid: SeedFoodRow[];
  skipped: SkippedSeedRow[];
}

function isFiniteNonNegative(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

const REQUIRED_MACRO_FIELDS = [
  "kcal_100g",
  "protein_100g",
  "carbs_100g",
  "fat_100g",
] as const;

/**
 * Clarified "Validation" rule: only rows with complete macros (kcal +
 * protein + carbs + fat) and a name are inserted. Everything else is
 * skipped (with a reason) rather than inserted -- this is the DoD "Failure
 * test": malformed-row input is skipped, not inserted.
 */
function findValidationError(raw: unknown): string | null {
  if (typeof raw !== "object" || raw === null) {
    return "row is not an object";
  }
  const r = raw as Record<string, unknown>;

  if (typeof r.name_sr !== "string" || r.name_sr.trim() === "") {
    return "missing or empty name_sr";
  }

  for (const field of REQUIRED_MACRO_FIELDS) {
    if (!isFiniteNonNegative(r[field])) {
      return `missing or invalid ${field}`;
    }
  }

  return null;
}

function normalizeSeedRow(raw: Record<string, unknown>): SeedFoodRow {
  const barcode =
    typeof raw.barcode === "string" && raw.barcode.trim() !== ""
      ? raw.barcode.trim()
      : undefined;

  return {
    name_sr: (raw.name_sr as string).trim(),
    brand:
      typeof raw.brand === "string" && raw.brand.trim() !== ""
        ? raw.brand.trim()
        : null,
    kcal_100g: raw.kcal_100g as number,
    protein_100g: raw.protein_100g as number,
    carbs_100g: raw.carbs_100g as number,
    fat_100g: raw.fat_100g as number,
    common_units: Array.isArray(raw.common_units)
      ? (raw.common_units as FoodCommonUnit[])
      : [],
    barcode,
  };
}

/** Validates+normalizes raw JSON rows (e.g. parsed from foods.json), routing
 * anything malformed into `skipped` (never into `valid`). */
export function validateSeedRows(rows: unknown[]): SeedValidationResult {
  const valid: SeedFoodRow[] = [];
  const skipped: SkippedSeedRow[] = [];

  for (const raw of rows) {
    const reason = findValidationError(raw);
    if (reason) {
      skipped.push({ row: raw, reason });
      continue;
    }
    valid.push(normalizeSeedRow(raw as Record<string, unknown>));
  }

  return { valid, skipped };
}

/**
 * Clarified Round-B decision #11: upsert key is the barcode when present,
 * else name_sr+brand (case-insensitive, whitespace-trimmed so casing/spacing
 * differences between runs never produce a false "new" row).
 */
export function upsertKey(
  row: Pick<SeedFoodRow, "name_sr" | "brand" | "barcode">
): string {
  if (row.barcode && row.barcode.trim() !== "") {
    return `barcode:${row.barcode.trim()}`;
  }
  return `name:${row.name_sr.trim().toLowerCase()}|${(row.brand ?? "")
    .trim()
    .toLowerCase()}`;
}

export interface ExistingFoodRow {
  id: string;
  name_sr: string;
  brand: string | null;
  barcode: string | null;
}

export interface UpsertPlan {
  toInsert: SeedFoodRow[];
  toUpdate: { id: string; row: SeedFoodRow }[];
}

/**
 * Builds an idempotent insert/update plan against a snapshot of rows already
 * present in the DB (`existing`, ordinarily scoped to source='seed'): any
 * seed row whose upsert key already matches an existing row is scheduled as
 * an UPDATE (by id, never a fresh INSERT); everything else is a new INSERT.
 *
 * Running `planSeedUpsert(rows, existing)` and then feeding the resulting
 * (post-apply) rows back in as the new `existing` snapshot always yields
 * `toInsert: []` -- this is what proves "re-run does not duplicate rows"
 * without needing a live database (see seed.test.ts).
 */
export function planSeedUpsert(
  rows: SeedFoodRow[],
  existing: ExistingFoodRow[]
): UpsertPlan {
  const existingByKey = new Map<string, ExistingFoodRow>();
  for (const e of existing) {
    existingByKey.set(
      upsertKey({
        name_sr: e.name_sr,
        brand: e.brand,
        barcode: e.barcode ?? undefined,
      }),
      e
    );
  }

  const toInsert: SeedFoodRow[] = [];
  const toUpdate: { id: string; row: SeedFoodRow }[] = [];

  for (const row of rows) {
    const match = existingByKey.get(upsertKey(row));
    if (match) {
      toUpdate.push({ id: match.id, row });
    } else {
      toInsert.push(row);
    }
  }

  return { toInsert, toUpdate };
}

/** Stamps a validated seed row for the DB write: source='seed',
 * verified=true, is_default=true, per the clarified Round-B decision #12.
 * `is_default=true` marks these as the pre-loaded starter catalog (0011) so a
 * fresh DB seeded from this script matches the live backfill; admin-entered
 * foods (createVerifiedFood) leave it false. `barcode` is left `undefined`
 * (not `null`) when absent so an UPDATE payload never clobbers an existing
 * row's barcode that this seed row simply doesn't carry. */
export function toFoodInsert(row: SeedFoodRow): FoodInsert {
  return {
    name_sr: row.name_sr,
    brand: row.brand,
    kcal_100g: row.kcal_100g,
    protein_100g: row.protein_100g,
    carbs_100g: row.carbs_100g,
    fat_100g: row.fat_100g,
    common_units: row.common_units,
    barcode: row.barcode ?? undefined,
    source: "seed",
    verified: true,
    is_default: true,
  };
}

/** kcal ≈ 4*protein + 4*carbs + 9*fat, within a rounding tolerance --
 * the clarified "internally consistent" validation the DoD's evidence
 * artifact (and AS-033/AS-034 tests) check across the whole dataset. */
export function isKcalConsistent(row: SeedFoodRow, toleranceKcal = 3): boolean {
  const expected =
    row.protein_100g * 4 + row.carbs_100g * 4 + row.fat_100g * 9;
  return Math.abs(expected - row.kcal_100g) <= toleranceKcal;
}
