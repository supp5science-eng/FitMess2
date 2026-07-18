import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

// F020: static verification of supabase/migrations/0004_foods_logs.sql.
//
// This suite checks the committed SQL source of truth itself -- it does not
// require a reachable Supabase project, so it stays green for every worker
// after this one regardless of whether a live database connection is
// available in their session. It complements, but does not replace,
// `foods-logs-rls.integration.test.ts`, which proves the *live* database
// actually behaves this way once the migration has been applied (see that
// file's header for current live-verification status). Same pattern as
// `schema-migration.test.ts` (F010).
//
// AS-032: a food record stores name_sr, brand, per-100g macros,
// common_units, source, verified, and an optional unique barcode -- verified
// here as "every one of those columns exists on public.foods with the right
// nullability, and barcode carries a UNIQUE constraint."
// AS-057: inserting a second food with an already-used barcode is
// rejected -- verified here as "public.foods.barcode has a UNIQUE
// constraint" (the live test proves the actual rejection).

const MIGRATION_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "supabase",
  "migrations",
  "0004_foods_logs.sql"
);

function readMigration(): string {
  return fs.readFileSync(MIGRATION_PATH, "utf-8");
}

/** Same deliberately naive SQL statement splitter as schema-migration.test.ts. */
function statements(sql: string): string[] {
  const withoutLineComments = sql
    .split("\n")
    .map((line) => {
      const idx = line.indexOf("--");
      return idx === -1 ? line : line.slice(0, idx);
    })
    .join("\n");

  return withoutLineComments
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

describe("F020: supabase/migrations/0004_foods_logs.sql (static schema checks)", () => {
  it("test_AS_032_migration_file_exists", () => {
    expect(fs.existsSync(MIGRATION_PATH)).toBe(true);
  });

  it("test_AS_032_extensions_pg_trgm_and_unaccent_are_enabled", () => {
    const sql = readMigration();
    expect(sql).toMatch(/create extension if not exists pg_trgm/i);
    expect(sql).toMatch(/create extension if not exists unaccent/i);
  });

  it("test_AS_032_foods_table_has_name_sr_brand_and_per_100g_macro_columns", () => {
    const sql = readMigration();
    expect(sql).toMatch(/create table if not exists public\.foods/i);
    expect(sql).toMatch(/name_sr\s+text not null/i);
    expect(sql).toMatch(/brand\s+text/i);
    expect(sql).toMatch(/kcal_100g\s+numeric/i);
    expect(sql).toMatch(/protein_100g\s+numeric/i);
    expect(sql).toMatch(/carbs_100g\s+numeric/i);
    expect(sql).toMatch(/fat_100g\s+numeric/i);
  });

  it("test_AS_032_foods_table_has_common_units_jsonb_source_and_verified_columns", () => {
    const sql = readMigration();
    expect(sql).toMatch(/common_units\s+jsonb not null default '\[\]'::jsonb/i);
    expect(sql).toMatch(
      /source\s+text not null default 'user' check \(source in \('seed', 'off', 'user'\)\)/i
    );
    expect(sql).toMatch(/verified\s+boolean not null default false/i);
  });

  it("test_AS_057_foods_barcode_column_is_nullable_text_with_a_unique_constraint", () => {
    const sql = readMigration();
    const barcodeLine = sql
      .split("\n")
      .find((line) => /^\s*barcode\s+text/i.test(line));
    expect(barcodeLine).toBeDefined();
    expect(barcodeLine).toMatch(/unique/i);
    // Nullable -- no `not null` on this column (most foods have no barcode).
    expect(barcodeLine).not.toMatch(/not null/i);
  });

  it("test_AS_032_foods_submitted_by_references_auth_users_and_anonymizes_on_delete_not_cascades", () => {
    const sql = readMigration();
    expect(sql).toMatch(
      /submitted_by\s+uuid references auth\.users \(id\) on delete set null/i
    );
  });

  it("test_AS_032_foods_has_label_photo_path_and_timestamp_columns", () => {
    const sql = readMigration();
    expect(sql).toMatch(/label_photo_path\s+text/i);
    expect(sql).toMatch(
      /foods[\s\S]*?created_at\s+timestamptz not null default now\(\)/i
    );
    expect(sql).toMatch(/updated_at\s+timestamptz not null default now\(\)/i);
  });

  it("test_AS_032_foods_has_row_level_security_enabled", () => {
    const sql = readMigration();
    expect(sql).toMatch(/alter table public\.foods enable row level security/i);
  });

  it("test_AS_032_foods_has_a_select_policy_readable_by_all_authenticated_users", () => {
    const sql = readMigration();
    const policyStatements = statements(sql).filter(
      (s) => /create policy/i.test(s) && /on public\.foods/i.test(s) && /for select/i.test(s)
    );
    expect(policyStatements).toHaveLength(1);
    expect(policyStatements[0]).toMatch(/to authenticated/i);
    expect(policyStatements[0]).toMatch(/using\s*\(\s*true\s*\)/i);
  });

  it("test_AS_032_foods_has_an_insert_policy_for_authenticated_users_scoped_to_their_own_submitted_by", () => {
    const sql = readMigration();
    const policyStatements = statements(sql).filter(
      (s) => /create policy/i.test(s) && /on public\.foods/i.test(s) && /for insert/i.test(s)
    );
    expect(policyStatements).toHaveLength(1);
    expect(policyStatements[0]).toMatch(/to authenticated/i);
    expect(policyStatements[0]).toMatch(/submitted_by\s*=\s*auth\.uid\(\)/i);
  });

  it("test_AS_032_foods_has_no_update_or_delete_policy_admin_only_via_service_role", () => {
    const sql = readMigration();
    const updateOrDeletePolicies = statements(sql).filter(
      (s) =>
        /create policy/i.test(s) &&
        /on public\.foods/i.test(s) &&
        (/for update/i.test(s) || /for delete/i.test(s))
    );
    expect(updateOrDeletePolicies).toHaveLength(0);
  });

  it("test_logs_table_has_user_owned_columns_and_snapshot_macro_fields", () => {
    const sql = readMigration();
    expect(sql).toMatch(/create table if not exists public\.logs/i);
    expect(sql).toMatch(
      /user_id\s+uuid not null references auth\.users \(id\) on delete cascade/i
    );
    expect(sql).toMatch(
      /food_id\s+uuid references public\.foods \(id\) on delete set null/i
    );
    expect(sql).toMatch(/name\s+text not null/i);
    expect(sql).toMatch(/grams\s+numeric/i);
    expect(sql).toMatch(/kcal\s+numeric/i);
    expect(sql).toMatch(/protein\s+numeric/i);
    expect(sql).toMatch(/carbs\s+numeric/i);
    expect(sql).toMatch(/fat\s+numeric/i);
    expect(sql).toMatch(/logged_at\s+timestamptz not null default now\(\)/i);
    expect(sql).toMatch(
      /method\s+text not null check \(method in \('search', 'barcode', 'label', 'meal', 'agent'\)\)/i
    );
  });

  it("test_logs_has_row_level_security_enabled_and_exactly_four_own_row_policies", () => {
    const sql = readMigration();
    expect(sql).toMatch(/alter table public\.logs enable row level security/i);

    const policyStatements = statements(sql).filter(
      (s) => /create policy/i.test(s) && /on public\.logs/i.test(s)
    );
    expect(policyStatements).toHaveLength(4);

    for (const stmt of policyStatements) {
      const hasUsingOwnRow = /using\s*\(\s*user_id\s*=\s*auth\.uid\(\)\s*\)/i.test(
        stmt
      );
      const hasCheckOwnRow =
        /with check\s*\(\s*user_id\s*=\s*auth\.uid\(\)\s*\)/i.test(stmt);
      expect(hasUsingOwnRow || hasCheckOwnRow).toBe(true);
      expect(stmt).toMatch(/to authenticated/i);
    }
  });

  it("test_logs_has_no_unconditional_true_policy", () => {
    const sql = readMigration();
    const logsPolicyStatements = statements(sql).filter(
      (s) => /create policy/i.test(s) && /on public\.logs/i.test(s)
    );
    for (const stmt of logsPolicyStatements) {
      expect(stmt).not.toMatch(/using\s*\(\s*true\s*\)/i);
      expect(stmt).not.toMatch(/with check\s*\(\s*true\s*\)/i);
    }
  });

  it("test_logs_has_an_index_on_user_id_and_logged_at_for_the_hot_daily_weekly_query_path", () => {
    const sql = readMigration();
    expect(sql).toMatch(
      /create index if not exists logs_user_id_logged_at_idx\s+on public\.logs \(user_id, logged_at desc\)/i
    );
  });

  it("test_AS_032_foods_and_logs_are_the_only_tables_this_migration_creates", () => {
    const sql = readMigration();
    const createTableStatements = statements(sql).filter((s) =>
      /^create table/i.test(s)
    );
    const tableNames = createTableStatements
      .map((s) => s.match(/create table(?: if not exists)?\s+(\S+)/i)?.[1])
      .filter(Boolean);
    expect(tableNames.sort()).toEqual(["public.foods", "public.logs"].sort());
  });
});
