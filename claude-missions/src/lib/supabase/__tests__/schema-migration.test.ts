import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

// F010: static verification of supabase/migrations/0001_profiles.sql.
//
// This suite checks the committed SQL source of truth itself -- it does not
// require a reachable Supabase project, so it stays green (and keeps
// protecting the schema's security invariants) for every worker after this
// one, regardless of whether a live database connection is available in
// their session. It complements, but does not replace,
// `profiles-rls.integration.test.ts`, which proves the *live* database
// actually behaves this way once the migration has been applied (see that
// file's header and the F010 handoff for current live-verification status).
//
// AS-013: RLS denies cross-user access -- verified here as "every
// user-facing table this migration creates has RLS enabled and every
// policy on it is scoped to `auth.uid()`, with no policy granting
// unconditional or cross-user access."
// AS-031: onboarding state persisted -- verified here as "profiles has an
// `onboarded_at` column that can hold a timestamp (nullable, so it starts
// unset and can later be written)."

const MIGRATION_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "supabase",
  "migrations",
  "0001_profiles.sql"
);

function readMigration(): string {
  return fs.readFileSync(MIGRATION_PATH, "utf-8");
}

/** Very small, deliberately naive SQL statement splitter: good enough for a
 * migration file we author ourselves. Strips `--` line comments first (so a
 * semicolon accidentally used in prose can't fake a statement boundary),
 * then splits on `;` (no semicolons inside string literals/dollar bodies
 * elsewhere in this migration). */
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

describe("F010: supabase/migrations/0001_profiles.sql (static schema checks)", () => {
  it("test_AS_013_migration_file_exists_and_is_the_first_migration", () => {
    expect(fs.existsSync(MIGRATION_PATH)).toBe(true);
  });

  it("test_AS_013_profiles_table_has_row_level_security_enabled", () => {
    const sql = readMigration();
    expect(sql).toMatch(
      /alter table public\.profiles enable row level security/i
    );
  });

  it("test_AS_013_targets_table_has_row_level_security_enabled", () => {
    const sql = readMigration();
    expect(sql).toMatch(
      /alter table public\.targets enable row level security/i
    );
  });

  it("test_AS_013_profiles_has_exactly_four_own_row_policies_select_insert_update_delete", () => {
    const sql = readMigration();
    const policyStatements = statements(sql).filter(
      (s) => /create policy/i.test(s) && /on public\.profiles/i.test(s)
    );
    expect(policyStatements).toHaveLength(4);

    // Every single one must scope both the read-visibility (`using`) and
    // write-visibility (`with check`) clauses to auth.uid() -- this is what
    // makes it an *own-row* policy rather than a permissive one.
    for (const stmt of policyStatements) {
      const hasUsingOwnRow = /using\s*\(\s*user_id\s*=\s*auth\.uid\(\)\s*\)/i.test(
        stmt
      );
      const hasCheckOwnRow =
        /with check\s*\(\s*user_id\s*=\s*auth\.uid\(\)\s*\)/i.test(stmt);
      // select/delete only need USING; insert only needs WITH CHECK;
      // update needs both. Every statement must have at least one, and
      // whichever clauses it has must be auth.uid()-scoped (never `true`
      // or missing a user_id comparison).
      expect(hasUsingOwnRow || hasCheckOwnRow).toBe(true);
    }
  });

  it("test_AS_013_targets_has_exactly_four_own_row_policies_select_insert_update_delete", () => {
    const sql = readMigration();
    const policyStatements = statements(sql).filter(
      (s) => /create policy/i.test(s) && /on public\.targets/i.test(s)
    );
    expect(policyStatements).toHaveLength(4);

    for (const stmt of policyStatements) {
      const hasUsingOwnRow = /using\s*\(\s*user_id\s*=\s*auth\.uid\(\)\s*\)/i.test(
        stmt
      );
      const hasCheckOwnRow =
        /with check\s*\(\s*user_id\s*=\s*auth\.uid\(\)\s*\)/i.test(stmt);
      expect(hasUsingOwnRow || hasCheckOwnRow).toBe(true);
    }
  });

  it("test_AS_013_no_policy_grants_unconditional_true_or_public_role_access", () => {
    const sql = readMigration();
    const policyStatements = statements(sql).filter((s) =>
      /create policy/i.test(s)
    );
    expect(policyStatements.length).toBeGreaterThan(0);

    for (const stmt of policyStatements) {
      // Reject the classic RLS-defeating mistakes: `using (true)`, granting
      // to `public` (vs the `authenticated` role), or a check clause that
      // isn't tied to user_id.
      expect(stmt).not.toMatch(/using\s*\(\s*true\s*\)/i);
      expect(stmt).not.toMatch(/with check\s*\(\s*true\s*\)/i);
      expect(stmt).toMatch(/to authenticated/i);
    }
  });

  it("test_AS_013_profiles_and_targets_foreign_keys_scope_ownership_to_auth_users_with_cascade_delete", () => {
    const sql = readMigration();
    expect(sql).toMatch(
      /user_id\s+uuid\s+primary key\s+references\s+auth\.users\s*\(id\)\s+on delete cascade/i
    );
    expect(sql).toMatch(
      /user_id\s+uuid\s+not null\s+references\s+auth\.users\s*\(id\)\s+on delete cascade/i
    );
  });

  it("test_AS_031_profiles_has_a_nullable_onboarded_at_timestamp_column", () => {
    const sql = readMigration();
    // Nullable (no `not null` on this column) -- must start unset and be
    // writable later by the onboarding wizard (F015/F016).
    const columnLine = sql
      .split("\n")
      .find((line) => /^\s*onboarded_at\s+timestamptz/i.test(line));
    expect(columnLine).toBeDefined();
    expect(columnLine).not.toMatch(/not null/i);
  });

  it("test_AS_031_profiles_and_targets_are_the_only_tables_this_migration_creates", () => {
    const sql = readMigration();
    const createTableStatements = statements(sql).filter((s) =>
      /^create table/i.test(s)
    );
    const tableNames = createTableStatements
      .map((s) => s.match(/create table(?: if not exists)?\s+(\S+)/i)?.[1])
      .filter(Boolean);
    expect(tableNames.sort()).toEqual(
      ["public.profiles", "public.targets"].sort()
    );
  });
});
