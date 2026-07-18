/**
 * F022: one-time import of Serbian-market products from the Open Food
 * Facts (OFF) public API into public.foods.
 *
 * Standalone Node/tsx script (clarified "Pattern" answer) -- run once by
 * the orchestrator/worker, never imported by application code:
 *
 *   npm run import:off
 *
 * Data source: OFF's "search-a-licious" search API
 * (https://search.openfoodfacts.org/search), which is what
 * world.openfoodfacts.org's own search UI calls today -- the older
 * `https://world.openfoodfacts.org/api/v2/search` endpoint returned HTTP
 * 503 ("Page temporarily unavailable") for every query tried during this
 * feature's implementation, while search-a-licious answered reliably. No
 * API key is required for either. Filtered to the Serbian market via
 * `countries_tags:"en:serbia"`, paginated, capped at IMPORT_CAP results.
 *
 * Quality filter (AS-035) + field mapping both live in the network-free,
 * unit-tested src/lib/food/off.ts -- this script only does I/O: fetch OFF
 * pages (with retry/backoff), fetch existing barcodes from the live DB,
 * call filterAndMapOffHits, and batch-upsert the result. It never
 * reimplements the filter.
 *
 * Idempotent: existing barcodes (from source='seed', 'off', or 'user') are
 * loaded before fetching OFF, so a barcode already in the DB is always
 * skipped-as-duplicate, never re-inserted (Round-B decision #15 -- re-run
 * does not duplicate rows). The final insert additionally upserts on
 * `barcode` with `ignoreDuplicates: true` as a second, DB-enforced layer
 * of the same guarantee (belt-and-braces against a barcode that slipped
 * past the in-memory Set, e.g. two workers running concurrently).
 *
 * Resilience: OFF is a third-party public API with a documented shared
 * rate limit. Every page fetch retries with exponential backoff on
 * non-2xx/network failure; if OFF becomes unreachable partway through,
 * the script stops paginating but still imports whatever it already
 * collected (partial-progress-safe) rather than throwing away a
 * successful partial run.
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/types/db";
import { filterAndMapOffHits, type MappedOffFood } from "../src/lib/food/off";

const ROOT = path.resolve(__dirname, "..");
const BATCH_SIZE = 50;

const OFF_SEARCH_URL = "https://search.openfoodfacts.org/search";
// countries_tags:"en:serbia" is OFF's canonical tag for "sold in Serbia".
const OFF_QUERY = 'countries_tags:"en:serbia"';
const OFF_FIELDS = "code,product_name,product_name_sr,brands,nutriments";
const OFF_USER_AGENT =
  "AdaptiveCut-OFF-Import/1.0 (one-time Serbian-market import script)";

const PAGE_SIZE = 100;
// Safety ceiling on pages fetched regardless of how many results OFF
// reports -- bounds worst-case runtime even if OFF's `count` is huge.
const MAX_PAGES = 40;
// Clarified Round-B decision #13: OFF import volume capped (~2000) and
// Serbian-market filtered. This caps the number of ROWS IMPORTED, not raw
// candidates fetched (most Serbian-tagged OFF products lack complete
// macros and are filtered out, per AS-035).
const IMPORT_CAP = 2000;

const RETRY_COUNT = 5;
const RETRY_BASE_DELAY_MS = 800;
const INTER_PAGE_DELAY_MS = 350;

/** Same minimal, dependency-free .env loader used by scripts/seed-foods.ts
 * and the F020/F021 live integration tests -- never overwrites a variable
 * already present in process.env, never logs a value. */
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

interface OffSearchResponse {
  hits?: unknown[];
  count?: number;
  page?: number;
  page_size?: number;
}

/** Fetches one OFF search page with exponential backoff on non-2xx or
 * network failure. Returns `null` (never throws) once retries are
 * exhausted, so the caller can stop paginating and proceed with whatever
 * was already collected instead of crashing the whole run. */
async function fetchOffPage(page: number): Promise<OffSearchResponse | null> {
  const url =
    `${OFF_SEARCH_URL}?q=${encodeURIComponent(OFF_QUERY)}` +
    `&page=${page}&page_size=${PAGE_SIZE}&fields=${OFF_FIELDS}`;

  for (let attempt = 0; attempt < RETRY_COUNT; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": OFF_USER_AGENT },
      });
      if (res.ok) {
        return (await res.json()) as OffSearchResponse;
      }
      console.warn(
        `import-off: page ${page} attempt ${attempt + 1}/${RETRY_COUNT} got HTTP ${res.status}`
      );
    } catch (err) {
      console.warn(
        `import-off: page ${page} attempt ${attempt + 1}/${RETRY_COUNT} threw:`,
        err instanceof Error ? err.message : err
      );
    }
    const delay = RETRY_BASE_DELAY_MS * 2 ** attempt;
    await sleep(delay);
  }

  console.error(
    `import-off: page ${page} failed after ${RETRY_COUNT} attempts -- giving up on further pagination.`
  );
  return null;
}

async function main(): Promise<void> {
  loadDotEnvIfPresent();

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    console.error(
      "import-off: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY " +
        "(checked process.env and .env) -- aborting without writing anything."
    );
    process.exitCode = 1;
    return;
  }

  const admin = createClient<Database>(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Idempotency (Round-B decision #15): load every existing barcode
  // (seed, prior OFF import, or user-submitted) so this run never
  // re-inserts a duplicate, regardless of which source put it there.
  // PostgREST caps a single response at 1000 rows by default (Supabase's
  // default API setting), so this pages through with `.range()` in chunks
  // of 1000 until a page comes back short -- otherwise, once this table
  // has passed 1000 barcoded rows, later runs would silently "forget"
  // some already-imported barcodes (harmless in practice, since the
  // DB-level `upsert(..., { onConflict: "barcode", ignoreDuplicates: true
  // })` below is a second, DB-enforced dedup layer -- but it would still
  // misreport the skipped-duplicate count and waste a write attempt).
  const existingBarcodes = new Set<string>();
  const EXISTING_PAGE_SIZE = 1000;
  for (let from = 0; ; from += EXISTING_PAGE_SIZE) {
    const { data: existingRows, error: existingErr } = await admin
      .from("foods")
      .select("barcode")
      .not("barcode", "is", null)
      .range(from, from + EXISTING_PAGE_SIZE - 1);

    if (existingErr) {
      console.error(
        "import-off: failed to load existing barcodes:",
        existingErr.message
      );
      process.exitCode = 1;
      return;
    }

    for (const row of existingRows ?? []) {
      if (typeof row.barcode === "string" && row.barcode.length > 0) {
        existingBarcodes.add(row.barcode);
      }
    }

    if (!existingRows || existingRows.length < EXISTING_PAGE_SIZE) break;
  }
  console.log(
    `import-off: ${existingBarcodes.size} existing barcode(s) loaded from public.foods -- these will be skipped as duplicates.`
  );

  const collected: MappedOffFood[] = [];
  let totalMissingMacros = 0;
  let totalDuplicate = 0;
  let totalRawFetched = 0;
  let stoppedEarlyDueToOffFailure = false;
  let reportedTotalCount: number | null = null;

  for (let page = 1; page <= MAX_PAGES; page++) {
    if (collected.length >= IMPORT_CAP) {
      console.log(
        `import-off: reached IMPORT_CAP (${IMPORT_CAP}) -- stopping pagination.`
      );
      break;
    }

    const response = await fetchOffPage(page);
    if (!response) {
      stoppedEarlyDueToOffFailure = true;
      break;
    }

    const hits = Array.isArray(response.hits) ? response.hits : [];
    reportedTotalCount = response.count ?? reportedTotalCount;
    totalRawFetched += hits.length;

    const { toInsert, skippedMissingMacros, skippedDuplicate } =
      filterAndMapOffHits(hits, existingBarcodes);

    for (const row of toInsert) {
      existingBarcodes.add(row.barcode); // guard against repeats on later pages
    }
    collected.push(...toInsert);
    totalMissingMacros += skippedMissingMacros.length;
    totalDuplicate += skippedDuplicate.length;

    console.log(
      `import-off: page ${page} -- fetched ${hits.length}, qualifying ${toInsert.length}, ` +
        `skipped-missing-macros ${skippedMissingMacros.length}, skipped-duplicate ${skippedDuplicate.length} ` +
        `(running total collected: ${collected.length})`
    );

    if (hits.length === 0) {
      console.log(`import-off: page ${page} returned no hits -- end of results.`);
      break;
    }
    if (page * PAGE_SIZE >= (reportedTotalCount ?? Infinity)) {
      console.log(`import-off: reached OFF's reported result count (${reportedTotalCount}).`);
      break;
    }

    await sleep(INTER_PAGE_DELAY_MS);
  }

  if (stoppedEarlyDueToOffFailure) {
    console.warn(
      "import-off: OFF API became unreachable partway through -- importing " +
        `whatever was already collected (${collected.length} row(s)) rather than aborting the whole run.`
    );
  }

  const toWrite = collected.slice(0, IMPORT_CAP);
  console.log(
    `import-off: raw candidates fetched ${totalRawFetched}; qualifying (complete macros + name) ${collected.length}; ` +
      `writing ${toWrite.length} (capped at ${IMPORT_CAP}); skipped-missing-macros ${totalMissingMacros}; skipped-duplicate ${totalDuplicate}.`
  );

  let insertedCount = 0;
  for (let i = 0; i < toWrite.length; i += BATCH_SIZE) {
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const batch = toWrite.slice(i, i + BATCH_SIZE).map((row) => row.insert);
    // upsert on barcode with ignoreDuplicates as a second, DB-enforced
    // idempotency layer beyond the in-memory existingBarcodes Set.
    const { error, count } = await admin
      .from("foods")
      .upsert(batch, { onConflict: "barcode", ignoreDuplicates: true, count: "exact" });

    if (error) {
      console.error(`import-off: upsert batch ${batchNum} failed:`, error.message);
      process.exitCode = 1;
      return;
    }
    insertedCount += count ?? batch.length;
    console.log(`import-off: upserted batch ${batchNum} (${batch.length} rows submitted)`);
  }

  const { count: offCount, error: offCountErr } = await admin
    .from("foods")
    .select("id", { count: "exact", head: true })
    .eq("source", "off");

  const { count: totalCount, error: totalCountErr } = await admin
    .from("foods")
    .select("id", { count: "exact", head: true });

  if (offCountErr || totalCountErr) {
    console.error(
      "import-off: failed to read final row count:",
      (offCountErr ?? totalCountErr)?.message
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `import-off: DONE. Submitted ${toWrite.length} row(s) for insert (server reported ${insertedCount} actually inserted, ` +
      `remainder were duplicates caught by the DB-level upsert). Live source='off' row count is now ${offCount}; ` +
      `total public.foods row count is now ${totalCount}. ` +
      `Summary -- imported: ${insertedCount}, skipped-missing-macros: ${totalMissingMacros}, skipped-duplicate: ${totalDuplicate + (toWrite.length - insertedCount)}.`
  );
}

main().catch((err) => {
  console.error("import-off: unexpected error:", err);
  process.exitCode = 1;
});
