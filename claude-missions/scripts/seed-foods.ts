/**
 * F021: idempotent seed script for the curated Serbian foods dataset.
 *
 * Standalone Node/tsx script (clarified "Pattern" answer) -- run once by
 * the orchestrator/worker, never imported by application code:
 *
 *   npm run seed:foods
 *
 * Reads supabase/seed/foods.json, validates+normalizes every row (pure
 * logic lives in src/lib/food/seed.ts so it's independently unit-testable),
 * and upserts into public.foods via the service-role admin client
 * (SUPABASE_SECRET_KEY -- bypasses RLS, same privileged-client pattern as
 * src/lib/supabase/server.ts's createAdminClient, reimplemented here
 * standalone so this script never imports next/headers).
 *
 * Idempotent: the upsert key is barcode when present, else
 * name_sr+brand (clarified Round-B decision #11), scoped to this table's
 * own previously-seeded (source='seed') rows only -- so re-running never
 * duplicates rows and never touches a crowd-sourced ('user') or
 * OFF-imported ('off') row that happens to share a name (definition-of-done
 * "side-effect verification: only the foods table is written", and only
 * the rows this script owns).
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/types/db";
import {
  planSeedUpsert,
  toFoodInsert,
  validateSeedRows,
  type ExistingFoodRow,
} from "../src/lib/food/seed";

const ROOT = path.resolve(__dirname, "..");
const DATASET_PATH = path.join(ROOT, "supabase", "seed", "foods.json");
const BATCH_SIZE = 50;

/** Same minimal, dependency-free .env loader used by the F020 live
 * integration tests (src/lib/supabase/__tests__/foods-logs-rls.integration.test.ts)
 * -- never overwrites a variable already present in process.env, never logs
 * a value. */
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

async function main(): Promise<void> {
  loadDotEnvIfPresent();

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    console.error(
      "seed-foods: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY " +
        "(checked process.env and .env) -- aborting without writing anything."
    );
    process.exitCode = 1;
    return;
  }

  if (!fs.existsSync(DATASET_PATH)) {
    console.error(`seed-foods: dataset not found at ${DATASET_PATH}`);
    process.exitCode = 1;
    return;
  }

  const rawRows = JSON.parse(
    fs.readFileSync(DATASET_PATH, "utf-8")
  ) as unknown[];
  console.log(
    `seed-foods: loaded ${rawRows.length} raw row(s) from ${DATASET_PATH}`
  );

  const { valid, skipped } = validateSeedRows(rawRows);
  if (skipped.length > 0) {
    console.warn(
      `seed-foods: skipping ${skipped.length} malformed row(s) (not inserted):`
    );
    for (const s of skipped) {
      console.warn(`  - ${s.reason}: ${JSON.stringify(s.row)}`);
    }
  }
  console.log(`seed-foods: ${valid.length} valid row(s) to upsert`);

  const admin = createClient<Database>(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: existingRows, error: fetchErr } = await admin
    .from("foods")
    .select("id, name_sr, brand, barcode")
    .eq("source", "seed");

  if (fetchErr) {
    console.error(
      "seed-foods: failed to fetch existing seed rows:",
      fetchErr.message
    );
    process.exitCode = 1;
    return;
  }

  const existing = (existingRows ?? []) as ExistingFoodRow[];
  const { toInsert, toUpdate } = planSeedUpsert(valid, existing);

  console.log(
    `seed-foods: plan -- ${toInsert.length} to insert, ${toUpdate.length} to update (already seeded)`
  );

  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const batch = toInsert.slice(i, i + BATCH_SIZE).map(toFoodInsert);
    const { error } = await admin.from("foods").insert(batch);
    if (error) {
      console.error(
        `seed-foods: insert batch ${batchNum} failed:`,
        error.message
      );
      process.exitCode = 1;
      return;
    }
    console.log(`seed-foods: inserted batch ${batchNum} (${batch.length} rows)`);
  }

  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const batch = toUpdate.slice(i, i + BATCH_SIZE);
    for (const { id, row } of batch) {
      const { error } = await admin
        .from("foods")
        .update(toFoodInsert(row))
        .eq("id", id);
      if (error) {
        console.error(
          `seed-foods: update of "${row.name_sr}" (${id}) failed:`,
          error.message
        );
        process.exitCode = 1;
        return;
      }
    }
    console.log(`seed-foods: updated batch ${batchNum} (${batch.length} rows)`);
  }

  const { count: seedCount, error: seedCountErr } = await admin
    .from("foods")
    .select("id", { count: "exact", head: true })
    .eq("source", "seed");

  const { count: totalCount, error: totalCountErr } = await admin
    .from("foods")
    .select("id", { count: "exact", head: true });

  if (seedCountErr || totalCountErr) {
    console.error(
      "seed-foods: failed to read final row count:",
      (seedCountErr ?? totalCountErr)?.message
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `seed-foods: DONE. Live source='seed' row count is now ${seedCount}; ` +
      `total public.foods row count is now ${totalCount}.`
  );
}

main().catch((err) => {
  console.error("seed-foods: unexpected error:", err);
  process.exitCode = 1;
});
