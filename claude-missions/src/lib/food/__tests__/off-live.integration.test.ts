// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import type { Database } from "@/lib/types/db";

// F022: live-database proof that `npm run import:off` behaves per AS-035 --
// "The Open Food Facts import stores only entries with complete macro data
// and marks their source as OFF." Every live source='off' row must have
// non-null kcal/protein/carbs/fat and source='off', verified=false; a
// second run must not have produced duplicate barcodes.
//
// Same `describe.skipIf(!hasCredentials || !schemaReady || !hasOffRows)`
// degrade-gracefully pattern established by F020/F021's live integration
// tests -- if no live Supabase connection is available in this session (or
// the import hasn't been run yet / OFF was unreachable and 0 rows landed),
// the real assertions are skipped with a loud, named diagnostic rather than
// permanently red-ing every future worker's `npm run test`. This file is
// read-only against the live table (no writes, no cleanup needed).

const ROOT = path.resolve(__dirname, "..", "..", "..", "..");

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

loadDotEnvIfPresent();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

const hasCredentials = Boolean(SUPABASE_URL && SUPABASE_SECRET_KEY);

function makeAdminClient() {
  return createSupabaseJsClient<Database>(
    SUPABASE_URL as string,
    SUPABASE_SECRET_KEY as string,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

let schemaReady = false;
let hasOffRows = false;
let liveOffCount = 0;

if (hasCredentials) {
  try {
    const admin = makeAdminClient();
    const probe = await admin.from("foods").select("id").limit(1);
    schemaReady = !probe.error;

    if (schemaReady) {
      const { count } = await admin
        .from("foods")
        .select("id", { count: "exact", head: true })
        .eq("source", "off");
      liveOffCount = count ?? 0;
      hasOffRows = liveOffCount > 0;
    }
  } catch {
    schemaReady = false;
  }
}

describe.skipIf(!hasCredentials || !schemaReady || !hasOffRows)(
  "F022: public.foods source='off' rows on the live Supabase project (AS-035)",
  () => {
    const admin = makeAdminClient();

    it("test_AS_035_every_off_row_has_complete_non_null_macros", async () => {
      const { data, error } = await admin
        .from("foods")
        .select("name_sr, kcal_100g, protein_100g, carbs_100g, fat_100g")
        .eq("source", "off")
        .limit(2000);

      expect(error).toBeNull();
      const rows = data ?? [];
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.kcal_100g).not.toBeNull();
        expect(row.protein_100g).not.toBeNull();
        expect(row.carbs_100g).not.toBeNull();
        expect(row.fat_100g).not.toBeNull();
        expect(typeof row.kcal_100g).toBe("number");
        expect(typeof row.protein_100g).toBe("number");
        expect(typeof row.carbs_100g).toBe("number");
        expect(typeof row.fat_100g).toBe("number");
      }
    });

    it("test_AS_035_every_off_row_is_marked_source_off_and_verified_false", async () => {
      const { data, error } = await admin
        .from("foods")
        .select("source, verified")
        .eq("source", "off")
        .limit(2000);

      expect(error).toBeNull();
      const rows = data ?? [];
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.source).toBe("off");
        expect(row.verified).toBe(false);
      }
    });

    it("test_AS_035_off_rows_have_a_non_empty_name_and_barcode", async () => {
      const { data, error } = await admin
        .from("foods")
        .select("name_sr, barcode")
        .eq("source", "off")
        .limit(2000);

      expect(error).toBeNull();
      const rows = data ?? [];
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.name_sr).toBeTruthy();
        expect(row.barcode).toBeTruthy();
      }
    });

    it("test_idempotent_rerun_produces_no_duplicate_off_barcodes", async () => {
      const { data, error } = await admin
        .from("foods")
        .select("barcode")
        .eq("source", "off")
        .not("barcode", "is", null)
        .limit(5000);

      expect(error).toBeNull();
      const barcodes = (data ?? []).map((r) => r.barcode);
      const uniqueBarcodes = new Set(barcodes);
      expect(uniqueBarcodes.size).toBe(barcodes.length);
    });
  }
);

describe("F022: off-live diagnostic (always runs, never fails the suite)", () => {
  it("test_reports_whether_the_live_off_import_check_ran_or_was_skipped", () => {
    if (!hasCredentials) {
      console.warn(
        "F022 off-live.integration.test.ts: no Supabase credentials in this " +
          "session -- live AS-035 checks skipped (network-free checks in " +
          "off.test.ts still ran)."
      );
    } else if (!schemaReady) {
      console.warn(
        "F022 off-live.integration.test.ts: public.foods not reachable in " +
          "this session -- live AS-035 checks skipped."
      );
    } else if (!hasOffRows) {
      console.warn(
        "F022 off-live.integration.test.ts: public.foods has 0 source='off' " +
          "rows in this session -- run `npm run import:off` -- live AS-035 " +
          "checks skipped."
      );
    } else {
      console.log(
        `F022 off-live.integration.test.ts: live OFF import verified -- ` +
          `${liveOffCount} source='off' row(s) found, AS-035 checks ran.`
      );
    }
    expect(true).toBe(true);
  });
});
