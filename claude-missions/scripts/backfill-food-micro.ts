/**
 * One-off AI backfill of the four micronutrient columns (0017) across the
 * `public.foods` catalog: fiber, total sugar, sodium and saturated fat per 100 g.
 *
 *   npm run backfill:micro          -- fill everything still missing
 *   npm run backfill:micro -- 40    -- stop after ~40 rows (a cheap smoke test)
 *
 * ## Why a script
 *
 * The home tab's second page ("vlakna / šećer / so / zasićene masti preostalo")
 * is only honest if the day's totals cover what the user actually ate. The
 * curated catalog carried macros only, so without this pass every meal logged
 * from search or a barcode would land as "unknown" and drag coverage to zero.
 *
 * Paying for the estimate ONCE PER FOOD (cached on the catalog row) instead of
 * once per log is the whole point: ~350 rows in batches of 25 is a handful of
 * Flash calls total, and every future log of those foods is free and instant.
 * `src/lib/food/micro-fill.ts` is the runtime counterpart for foods created
 * later (barcode scans, user submissions).
 *
 * ## Safety
 *
 * - Idempotent + resumable: it only ever SELECTS rows where `fiber_100g is null`
 *   and only ever UPDATEs with the same `is('fiber_100g', null)` guard, so a
 *   re-run after a crash picks up exactly what's left and can never overwrite a
 *   value read off a real declaration (`micro_source = 'label'`).
 * - Never touches macros, names, prices or any other column.
 * - Rows the model skips or answers implausibly for are LEFT NULL (still
 *   unknown) rather than filled with a guess -- unknown is a first-class state
 *   throughout the micro pipeline.
 * - Service-role client, because `foods` is a shared catalog with no UPDATE RLS
 *   policy (see `supabase/migrations/0004_foods_logs.sql`).
 *
 * The estimator itself (prompt, JSON schema, unit rules, sanity clamps) lives in
 * `src/lib/ai/micro-estimate.ts` and is shared with the runtime path -- this
 * script only does I/O and progress reporting.
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

import {
  estimateFoodMicrosBatch,
  MICRO_BATCH_SIZE,
} from "../src/lib/ai/micro-estimate";
import type { Database } from "../src/lib/types/db";

const ROOT = path.resolve(__dirname, "..");

/** Pause between batches -- polite to the API, and keeps us clear of per-minute
 * rate limits on the free tier. */
const INTER_BATCH_DELAY_MS = 1200;

/** Same minimal, dependency-free .env loader the other scripts use: never
 * overwrites an existing variable, never logs a value. */
function loadDotEnvIfPresent(): void {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) return;

  for (const rawLine of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const eq = line.indexOf("=");
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  loadDotEnvIfPresent();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY -- check .env"
    );
    process.exit(1);
  }
  if (!process.env.GEMINI_API_KEY) {
    console.error("Missing GEMINI_API_KEY -- check .env");
    process.exit(1);
  }

  const limitArg = Number(process.argv[2]);
  const limit = Number.isFinite(limitArg) && limitArg > 0 ? limitArg : Infinity;

  const supabase = createClient<Database>(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: pending, error } = await supabase
    .from("foods")
    .select("id, name_sr, brand, kcal_100g, protein_100g, carbs_100g, fat_100g")
    .is("fiber_100g", null)
    .eq("is_removed", false)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Could not read the catalog:", error.message);
    process.exit(1);
  }

  const rows = (pending ?? []).slice(0, limit === Infinity ? undefined : limit);
  console.log(
    `Foods missing micronutrients: ${pending?.length ?? 0}` +
      (rows.length !== (pending?.length ?? 0)
        ? ` (processing ${rows.length} this run)`
        : "")
  );
  if (rows.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  let filled = 0;
  let skipped = 0;

  for (let start = 0; start < rows.length; start += MICRO_BATCH_SIZE) {
    const batch = rows.slice(start, start + MICRO_BATCH_SIZE);
    const batchNumber = Math.floor(start / MICRO_BATCH_SIZE) + 1;
    const batchCount = Math.ceil(rows.length / MICRO_BATCH_SIZE);
    process.stdout.write(
      `Batch ${batchNumber}/${batchCount} (${batch.length} foods)... `
    );

    const estimates = await estimateFoodMicrosBatch(
      batch.map((food) => ({
        name: food.name_sr,
        brand: food.brand,
        kcal100g: food.kcal_100g,
        protein100g: food.protein_100g,
        carbs100g: food.carbs_100g,
        fat100g: food.fat_100g,
      }))
    );

    let batchFilled = 0;
    for (let index = 0; index < batch.length; index++) {
      const food = batch[index];
      const estimate = estimates[index];
      if (!estimate) {
        skipped++;
        continue;
      }

      const { error: updateError } = await supabase
        .from("foods")
        .update({
          fiber_100g: estimate.fiber_100g,
          sugar_100g: estimate.sugar_100g,
          sodium_100g: estimate.sodium_100g,
          sat_fat_100g: estimate.sat_fat_100g,
          micro_source: "ai",
        })
        .eq("id", food.id)
        // Never overwrite a real declaration or a concurrent fill.
        .is("fiber_100g", null);

      if (updateError) {
        console.warn(`\n  ! ${food.name_sr}: ${updateError.message}`);
        skipped++;
        continue;
      }
      batchFilled++;
      filled++;
    }

    console.log(`${batchFilled} filled`);
    if (start + MICRO_BATCH_SIZE < rows.length) {
      await sleep(INTER_BATCH_DELAY_MS);
    }
  }

  console.log(`\nDone. Filled ${filled}, left unknown ${skipped}.`);
  if (skipped > 0) {
    console.log("Re-run to retry the ones left unknown.");
  }
}

void main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
